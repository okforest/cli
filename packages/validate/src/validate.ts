import type { Concept, ReservedFile, Tree, TreeOutline } from "@okforest/okf"
import { defaultDiagramLoaders } from "./rules/diagrams.js"
import { defaultRules } from "./rules/index.js"
import type { CheckContext, Finding, Rule, ValidateOptions, ValidationResult } from "./types.js"

/**
 * Validate a tree. Rules run in order; each finding carries its rule's
 * severity (or the override in `options.severity`). Resources created with
 * `once` are disposed before returning, even when a rule throws.
 */
export async function validate(
  tree: Tree,
  options: ValidateOptions = {},
): Promise<ValidationResult> {
  const files = [...tree.concepts, ...tree.reserved].sort((a, b) => compare(a.path, b.path))
  const run = new Run(
    {
      files: tree.files,
      markdown: files.map((file) => file.path),
      ignored: tree.ignored,
      ...(tree.settings ? { settings: tree.settings } : {}),
    },
    options,
  )
  try {
    for (const file of files) await run.file(file)
    return await run.finish()
  } finally {
    await run.dispose()
  }
}

/** Checks a tree read one file at a time ({@link TreeOutline.read}). */
export interface TreeChecker {
  /** Checks one of the outline's markdown files, as read. */
  check(file: Concept | ReservedFile): Promise<void>
  /** Checks the tree as a whole, and returns every finding, as
   * {@link validate} would for the whole tree. Always call it: it also
   * disposes of the run's resources (diagram engines). */
  finish(): Promise<ValidationResult>
}

/**
 * Validate a tree too large to hold parsed at once: give it each of the
 * outline's markdown files as it's read ({@link TreeChecker.check}), then
 * {@link TreeChecker.finish}. The findings are {@link validate}'s for the
 * same tree.
 */
export function treeChecker(outline: TreeOutline, options: ValidateOptions = {}): TreeChecker {
  const run = new Run(outline, options)
  return {
    check: (file) => run.file(file),
    finish: async () => {
      try {
        return await run.finish()
      } finally {
        await run.dispose()
      }
    },
  }
}

/** One validation run: its rules, findings, and shared resources. */
class Run {
  readonly #rules: { rule: Rule; context: CheckContext }[] = []
  readonly #findings: Finding[] = []
  readonly #disposers: (() => unknown)[] = []
  #concepts = 0
  #files = 0

  constructor(outline: CheckContext["outline"], options: ValidateOptions) {
    const now = options.now ?? new Date()
    const diagrams = {
      d2: options.diagrams?.d2 ?? defaultDiagramLoaders.d2,
      mermaid: options.diagrams?.mermaid ?? defaultDiagramLoaders.mermaid,
    }
    const resources = new Map<string, Promise<unknown>>()
    const once: CheckContext["once"] = (key, create, dispose) => {
      const existing = resources.get(key)
      if (existing) return existing as ReturnType<typeof create>
      const created = create()
      resources.set(key, created)
      if (dispose) this.#disposers.push(() => created.then(dispose))
      return created
    }
    for (const rule of options.rules ?? defaultRules) {
      const severity = options.severity?.[rule.id] ?? rule.severity
      if (severity === "off") continue
      this.#rules.push({
        rule,
        context: {
          outline,
          now,
          once,
          diagrams,
          // A fixed key order keeps JSON output stable for tools that consume it.
          report: ({ file, line, column, message }) =>
            this.#findings.push({
              ruleId: rule.id,
              severity,
              file,
              ...(line === undefined ? {} : { line }),
              ...(column === undefined ? {} : { column }),
              message,
            }),
        },
      })
    }
  }

  async file(file: Concept | ReservedFile): Promise<void> {
    this.#files++
    if (file.kind === "concept") this.#concepts++
    for (const { rule, context } of this.#rules) await rule.checkFile?.(file, context)
  }

  /** The tree-wide checks, then every finding. */
  async finish(): Promise<ValidationResult> {
    for (const { rule, context } of this.#rules) await rule.checkTree?.(context)
    const findings = this.#findings.sort(compareFindings)
    const count = (severity: Finding["severity"]) =>
      findings.filter((f) => f.severity === severity).length
    const errors = count("error")
    return {
      findings,
      errors,
      warnings: count("warning"),
      infos: count("info"),
      concepts: this.#concepts,
      files: this.#files,
      ok: errors === 0,
    }
  }

  async dispose(): Promise<void> {
    await Promise.allSettled(this.#disposers.map((dispose) => dispose()))
  }
}

function compareFindings(a: Finding, b: Finding): number {
  return (
    compare(a.file, b.file) ||
    (a.line ?? 0) - (b.line ?? 0) ||
    (a.column ?? 0) - (b.column ?? 0) ||
    compare(a.ruleId, b.ruleId) ||
    compare(a.message, b.message)
  )
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
