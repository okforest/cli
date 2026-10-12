import type { CodeBlock } from "@okforest/okf"
import type { Report, Rule, RuleContext } from "../types.js"

type Language = "d2" | "mermaid"

interface Located {
  message: string
  line: number
  column: number
}

type Outcome = { file: string; block: CodeBlock } & (
  | { status: "ok" }
  | { status: "error"; errors: Located[] }
  | { status: "unchecked"; reason: string }
)

/** Checks one diagram's source; throws a {@link Unchecked} when it cannot tell. */
type Checker = (source: string) => Promise<Located[] | undefined>

class Unchecked extends Error {}

const PACKAGES: Record<Language, string> = { d2: "@d2lang/d2", mermaid: "mermaid" }

/**
 * Load the optional peer for a language once per run. Resolves to undefined
 * when the package is not installed, so validation still runs without the
 * ~200 MB of diagram tooling (`npx okforest validate` stays small).
 */
async function loadChecker(context: RuleContext, language: Language): Promise<Checker | undefined> {
  return context
    .once(
      `diagram-engine:${language}`,
      async () => {
        try {
          return language === "d2" ? await loadD2() : await loadMermaid()
        } catch (error) {
          if (isMissingModule(error)) return undefined
          throw error
        }
      },
      (engine) => engine?.dispose(),
    )
    .then((engine) => engine?.check)
}

interface Engine {
  check: Checker
  dispose(): unknown
}

interface D2Instance {
  compile(source: string): Promise<unknown>
  dispose(): Promise<void>
}

async function loadD2(): Promise<Engine> {
  const { D2 } = (await import("@d2lang/d2")) as unknown as { D2: new () => D2Instance }
  const d2 = new D2()
  return {
    check: async (source) => {
      try {
        await d2.compile(source)
        return undefined
      } catch (error) {
        return d2Errors(error)
      }
    },
    dispose: () => d2.dispose(),
  }
}

/** D2.js rejects with a JSON list of `{ range, errmsg: "index:<line>:<col>: <message>" }`. */
function d2Errors(error: unknown): Located[] {
  const text = error instanceof Error ? error.message : String(error)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Unchecked(`D2 could not check this diagram: ${text}`)
  }
  if (!Array.isArray(parsed)) throw new Unchecked(`D2 could not check this diagram: ${text}`)
  return parsed.map((entry) => {
    const message = String((entry as { errmsg?: unknown })?.errmsg ?? entry)
    const m = /^[^:]*:(\d+):(\d+): (.*)$/s.exec(message)
    return m
      ? { line: Number(m[1]), column: Number(m[2]), message: m[3] as string }
      : { line: 1, column: 1, message }
  })
}

interface MermaidApi {
  initialize(config: Record<string, unknown>): void
  parse(source: string): Promise<unknown>
}

async function loadMermaid(): Promise<Engine> {
  const mermaid = (await import("mermaid")).default as unknown as MermaidApi
  mermaid.initialize({ startOnLoad: false, logLevel: "fatal" })
  return {
    check: async (source) => {
      try {
        await mermaid.parse(source)
        return undefined
      } catch (error) {
        return mermaidErrors(error)
      }
    },
    dispose: () => undefined,
  }
}

function mermaidErrors(error: unknown): Located[] {
  const text = error instanceof Error ? error.message : String(error)
  // Some diagram types (pie, gitGraph, architecture, ...) sanitize with
  // DOMPurify while parsing, which needs a browser DOM that Node lacks.
  if (/DOMPurify|document is not defined|window is not defined/.test(text)) {
    throw new Unchecked(
      "Mermaid's parser for this diagram type needs a browser and cannot run here.",
    )
  }
  const lines = text.split("\n").map((l) => l.trim())
  const detail = lines
    .filter((l, i) => i === 0 || /^Expecting/.test(l))
    .map((l) => l.replace(/^(Expecting (?:'[^']*', ){4})(?:'[^']*', )+/, "$1..., "))
  const position = /line (\d+)(?:,? column (\d+))?/i.exec(text)
  return [
    {
      line: position ? Number(position[1]) : 1,
      column: position?.[2] ? Number(position[2]) : 1,
      message: detail.join(" ").replace(/:$/, ""),
    },
  ]
}

/** Whether an import failed because the package is not installed. Loaders and
 * test runners may wrap the original error, so the `cause` chain is followed. */
function isMissingModule(error: unknown): boolean {
  for (let e = error; e; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code
    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") return true
  }
  return false
}

/** Every diagram of a language, checked once per run and shared by the rules below. */
function outcomes(context: RuleContext, language: Language): Promise<Outcome[]> {
  return context.once(`diagram-outcomes:${language}`, async () => {
    const blocks = [...context.tree.concepts, ...context.tree.reserved].flatMap((file) =>
      file.codeBlocks
        .filter((block) => block.lang?.toLowerCase() === language)
        .map((block) => ({ file: file.path, block })),
    )
    if (blocks.length === 0) return []
    const check = await loadChecker(context, language)
    const results: Outcome[] = []
    for (const { file, block } of blocks) {
      if (!check) {
        results.push({
          file,
          block,
          status: "unchecked",
          reason: `Install \`${PACKAGES[language]}\` alongside okforest to check ${language === "d2" ? "D2" : "Mermaid"} syntax.`,
        })
        continue
      }
      try {
        const errors = await check(block.value)
        results.push(
          errors ? { file, block, status: "error", errors } : { file, block, status: "ok" },
        )
      } catch (error) {
        if (!(error instanceof Unchecked)) throw error
        results.push({ file, block, status: "unchecked", reason: error.message })
      }
    }
    return results
  })
}

function syntaxRule(language: Language, name: string): Rule {
  return {
    id: `okforest/${language}-syntax`,
    severity: "error",
    description: `\`${language}\` code blocks are valid ${name} (diagrams as code).`,
    async check(context) {
      for (const outcome of await outcomes(context, language)) {
        if (outcome.status !== "error") continue
        // Parsers report end-of-input one line past the source; keep findings
        // inside the block rather than on its closing fence.
        const lastLine = Math.max(outcome.block.value.split("\n").length, 1)
        for (const error of outcome.errors) {
          context.report({
            file: outcome.file,
            line: outcome.block.contentLine + Math.min(Math.max(error.line, 1), lastLine) - 1,
            column: error.column,
            message: `${name} syntax error: ${error.message}`,
          } satisfies Report)
        }
      }
    },
  }
}

export const d2Syntax = syntaxRule("d2", "D2")
export const mermaidSyntax = syntaxRule("mermaid", "Mermaid")

export const diagramUnchecked: Rule = {
  id: "okforest/diagram-unchecked",
  severity: "info",
  description:
    "Reports diagram blocks whose syntax could not be checked (tool not installed or unsupported here).",
  async check(context) {
    for (const language of ["d2", "mermaid"] as const) {
      for (const outcome of await outcomes(context, language)) {
        if (outcome.status !== "unchecked") continue
        context.report({
          file: outcome.file,
          line: outcome.block.line,
          column: 1,
          message: `${language === "d2" ? "D2" : "Mermaid"} diagram not checked: ${outcome.reason}`,
        })
      }
    }
  },
}
