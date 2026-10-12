import type { Tree } from "@okforest/okf"

/** `error` fails validation; `warning` and `info` are reported but never fail. */
export type Severity = "error" | "warning" | "info"

/** One problem, at a file and (when known) a 1-based line and column. */
export interface Finding {
  ruleId: string
  severity: Severity
  message: string
  /** Bundle-relative path. */
  file: string
  line?: number
  column?: number
}

/** What a rule passes to {@link RuleContext.report}. */
export interface Report {
  message: string
  file: string
  line?: number
  column?: number
}

export interface RuleContext {
  tree: Tree
  /** The instant staleness and dates are judged against. */
  now: Date
  report(report: Report): void
  /**
   * Create a resource once per validation run and share it between rules
   * (a diagram engine, parsed standards). `dispose` runs when the run ends.
   */
  once<T>(key: string, create: () => Promise<T>, dispose?: (value: T) => unknown): Promise<T>
}

/**
 * A validation rule. IDs are stable and namespaced: `okf/*` for the OKF
 * specification, `okforest/*` for OKForest conventions; organization
 * standards will plug in as another namespace.
 */
export interface Rule {
  id: string
  /** Default severity; callers may override it per rule. */
  severity: Severity
  /** One sentence: what the rule checks. */
  description: string
  check(context: RuleContext): void | Promise<void>
}

export interface ValidateOptions {
  /** Rules to run; defaults to {@link defaultRules}. */
  rules?: readonly Rule[]
  /** Per-rule severity overrides, or `off` to skip a rule. */
  severity?: Readonly<Record<string, Severity | "off">>
  /** Defaults to the current time. */
  now?: Date
}

export interface ValidationResult {
  /** Sorted by file, line, column, then rule ID. */
  findings: Finding[]
  errors: number
  warnings: number
  infos: number
  /** Concepts in the tree. */
  concepts: number
  /** Markdown files checked: concepts plus `index.md` and `log.md` files. */
  files: number
  /** True when there are no errors. */
  ok: boolean
}
