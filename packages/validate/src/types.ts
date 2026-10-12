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
  /** Where diagram engines come from: {@link ValidateOptions.diagrams}, or the defaults. */
  diagrams: Required<DiagramLoaders>
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
  /** Where diagram engines come from; defaults import the optional peers. */
  diagrams?: DiagramLoaders
}

/** The parts of D2.js (`@d2lang/d2`) the D2 rule uses. */
export interface D2Module {
  D2: new () => {
    compile(source: string): Promise<unknown>
    dispose(): Promise<void>
  }
}

/** The parts of Mermaid (`mermaid`) the Mermaid rule uses. */
export interface MermaidModule {
  default: {
    initialize(config: Record<string, unknown>): void
    parse(source: string): Promise<unknown>
  }
}

/** A diagram engine that cannot be used here, and why (shown to the user). */
export interface Unavailable {
  unavailable: string
}

/**
 * Where diagram engines come from. Each loader runs at most once per
 * validation run, and only when the tree has diagrams of that language. It
 * returns the module, or {@link Unavailable} to report those diagrams as not
 * checked. The defaults import the optional peers `@d2lang/d2` and `mermaid`;
 * supply your own to load them from elsewhere (a download, a bundle).
 */
export interface DiagramLoaders {
  d2?: () => Promise<D2Module | Unavailable>
  mermaid?: () => Promise<MermaidModule | Unavailable>
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
