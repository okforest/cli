import type { Tree } from "@okforest/okf"
import { defaultRules } from "./rules/index.js"
import type { Finding, RuleContext, ValidateOptions, ValidationResult } from "./types.js"

/**
 * Validate a tree. Rules run in order; each finding carries its rule's
 * severity (or the override in `options.severity`). Resources created with
 * `once` are disposed before returning, even when a rule throws.
 */
export async function validate(
  tree: Tree,
  options: ValidateOptions = {},
): Promise<ValidationResult> {
  const rules = options.rules ?? defaultRules
  const now = options.now ?? new Date()
  const findings: Finding[] = []
  const resources = new Map<string, Promise<unknown>>()
  const disposers: (() => unknown)[] = []

  const once: RuleContext["once"] = (key, create, dispose) => {
    const existing = resources.get(key)
    if (existing) return existing as ReturnType<typeof create>
    const created = create()
    resources.set(key, created)
    if (dispose) disposers.push(() => created.then(dispose))
    return created
  }

  try {
    for (const rule of rules) {
      const severity = options.severity?.[rule.id] ?? rule.severity
      if (severity === "off") continue
      await rule.check({
        tree,
        now,
        once,
        // A fixed key order keeps JSON output stable for tools that consume it.
        report: ({ file, line, column, message }) =>
          findings.push({
            ruleId: rule.id,
            severity,
            file,
            ...(line === undefined ? {} : { line }),
            ...(column === undefined ? {} : { column }),
            message,
          }),
      })
    }
  } finally {
    await Promise.allSettled(disposers.map((dispose) => dispose()))
  }

  findings.sort(compareFindings)
  const count = (severity: Finding["severity"]) =>
    findings.filter((f) => f.severity === severity).length
  const errors = count("error")
  return {
    findings,
    errors,
    warnings: count("warning"),
    infos: count("info"),
    concepts: tree.concepts.length,
    files: tree.concepts.length + tree.reserved.length,
    ok: errors === 0,
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
