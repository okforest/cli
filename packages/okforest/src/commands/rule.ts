import { parseArgs } from "node:util"
import {
  defaultRules,
  okfRules,
  type Rule,
  type RuleDocs,
  ruleDocs,
  ruleUrl,
} from "@okforest/validate"
import { formatOption } from "../args.js"
import { EXIT, type Io, paint, UsageError } from "../io.js"

const HELP = `Usage: okforest rule [rule] [--format text|json]

Explain a rule: why it exists, an example that breaks it, what
\`okforest validate\` reports for it, and the fix. Without a rule, list every
rule with its severity.

Options
  --format text|json   Output format (default: text). JSON is for tools and agents.

Examples
  okforest rule okf/type
  okforest rule --format json okforest/slug
`

const COLOR = { error: "red", warning: "yellow", info: "cyan" } as const
/** Text is wrapped to this width, as a terminal shows it comfortably. */
const WIDTH = 80

export async function ruleCommand(args: readonly string[], io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { format: { type: "string" }, help: { type: "boolean", short: "h" } },
    allowPositionals: true,
    strict: true,
  })
  if (values.help) {
    io.stdout(HELP)
    return EXIT.ok
  }
  if (positionals.length > 1) {
    throw new UsageError(`Expected one rule, got ${positionals.length}: ${positionals.join(" ")}`)
  }
  const format = formatOption(values.format)
  const [id] = positionals
  if (id === undefined) {
    io.stdout(format === "json" ? json(defaultRules.map(describe)) : list(io))
    return EXIT.ok
  }
  const rule = defaultRules.find((found) => found.id === id)
  if (!rule) {
    const near = closest(id)
    throw new UsageError(
      `Unknown rule \`${id}\`.${near ? ` Did you mean \`${near}\`?` : ""} Run \`okforest rule\` to list them.`,
    )
  }
  io.stdout(format === "json" ? json(describe(rule)) : explain(rule, io))
  return EXIT.ok
}

/** Which set a rule belongs to. */
const set = (rule: Rule) => (okfRules.includes(rule) ? "OKF specification" : "OKForest conventions")

/** A rule as data: what `--format json` prints. */
function describe(rule: Rule) {
  const docs: RuleDocs | undefined = ruleDocs[rule.id]
  return {
    id: rule.id,
    severity: rule.severity,
    set: set(rule),
    description: rule.description,
    url: ruleUrl(rule.id),
    ...(docs && { why: docs.why, example: docs.example }),
  }
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

/** Every rule, by set and then by ID (as the docs list them), with its
 * severity and description. */
function list(io: Io): string {
  const width = Math.max(...defaultRules.map((rule) => rule.id.length))
  const out: string[] = []
  for (const name of ["OKF specification", "OKForest conventions"]) {
    out.push(paint(io, "underline", name))
    const rules = defaultRules
      .filter((found) => set(found) === name)
      .sort((a, b) => a.id.localeCompare(b.id))
    for (const rule of rules) {
      out.push(
        `  ${rule.id.padEnd(width)}  ${paint(io, COLOR[rule.severity], rule.severity.padEnd(7))}  ${rule.description}`,
      )
    }
    out.push("")
  }
  out.push("Run `okforest rule <rule>` for why a rule exists and how to fix it.")
  return `${out.join("\n")}\n`
}

/** One rule, explained: what the text format prints. */
function explain(rule: Rule, io: Io): string {
  const docs: RuleDocs | undefined = ruleDocs[rule.id]
  const heading = (text: string) => paint(io, "underline", text)
  const out = [
    `${paint(io, "bold", rule.id)}  ${paint(io, COLOR[rule.severity], rule.severity)}  ${paint(io, "dim", set(rule))}`,
    "",
    ...wrap(rule.description, ""),
    "",
  ]
  const links: string[] = []
  if (docs) {
    out.push(heading("Why"), ...wrap(plain(docs.why, links), "  "), "")
    const { file, fails, findings, fixed, fixedFile = file } = docs.example
    out.push(heading(`Example: ${file} breaks the rule`), ...block(fails), "")
    out.push(heading("okforest validate reports"), `  ${file}`)
    for (const finding of findings) {
      const [at = "", ...message] = finding.split(" ")
      out.push(
        `    ${at === "-:-" ? "" : at}  ${paint(io, COLOR[rule.severity], rule.severity.padEnd(7))}  ${message.join(" ")}`,
      )
    }
    out.push("")
    if (fixed === undefined) out.push(heading("Nothing to fix"), "")
    else {
      const renamed = fixedFile === file ? "" : `, renamed to ${fixedFile}`
      out.push(heading(`Fixed${renamed}`), ...block(fixed), "")
    }
  }
  if (links.length > 0) {
    out.push(heading("Links"), ...links.map((url, i) => `  [${i + 1}] ${url}`), "")
  }
  out.push(`Docs: ${ruleUrl(rule.id)}`)
  return `${out.join("\n")}\n`
}

/** Markdown as terminal text: each link becomes `text [n]`, its URL listed
 * under Links; bold is dropped; code spans keep their backticks. */
function plain(markdown: string, links: string[]): string {
  return markdown
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text: string, url: string) => {
      const known = links.indexOf(url)
      const n = known === -1 ? links.push(url) : known + 1
      return `${text} [${n}]`
    })
    .replace(/\*\*([^*]+)\*\*/g, "$1")
}

/** A paragraph wrapped to WIDTH, each line indented. */
function wrap(text: string, indent: string): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/)) {
    if (line && indent.length + line.length + 1 + word.length > WIDTH) {
      lines.push(`${indent}${line}`)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(`${indent}${line}`)
  return lines
}

/** A file's text, indented as a block. */
const block = (text: string) =>
  text
    .trimEnd()
    .split("\n")
    .map((line) => (line ? `  ${line}` : ""))

/** The rule ID nearest to a mistyped one, if any is close: the same name
 * in the other set (`okf/slug` → `okforest/slug`), or one or two edits away. */
function closest(id: string): string | undefined {
  const name = id.split("/").pop() ?? id
  const sameName = defaultRules.find((rule) => rule.id.split("/").pop() === name)
  if (sameName) return sameName.id
  let best: { id: string; distance: number } | undefined
  for (const rule of defaultRules) {
    const distance = edits(id, rule.id)
    if (distance <= 2 && (!best || distance < best.distance)) best = { id: rule.id, distance }
  }
  return best?.id
}

/** Levenshtein distance. */
function edits(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        (previous[j] as number) + 1,
        (current[j - 1] as number) + 1,
        (previous[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length] as number
}
