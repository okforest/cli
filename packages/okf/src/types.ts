import type { Root } from "mdast"

/** A 1-based line and column in a file. */
export interface Position {
  line: number
  column: number
}

/** A problem found while reading a file, kept for the validator to report. */
export interface Diagnostic {
  message: string
  line?: number
  column?: number
}

/** A path into a YAML mapping: keys, or indexes into sequences. */
export type KeyPath = readonly (string | number)[]

/** OKF v0.2 trust tier, derived from `verified` (spec §5.3). */
export type TrustTier = "unverified" | "machine-confirmed" | "human-reviewed"

/** OKF v0.2 lifecycle status (spec §5.4). */
export type Status = "draft" | "stable" | "deprecated"

/** A file handed to {@link parseTree}: a bundle-relative POSIX path and, for
 * markdown and settings files, its text. Other files only need a path, so
 * links to them can be checked. */
export interface TreeFile {
  path: string
  text?: string
}

/** A markdown link, image, or link reference found in a document body. */
export interface Link {
  /** Bundle-relative path of the file containing the link. */
  from: string
  /** The destination as written. */
  target: string
  line: number
  column: number
  /** `external`: has a URL scheme; `anchor`: same-document fragment only;
   * `internal`: a path within (or escaping) the bundle. */
  kind: "internal" | "external" | "anchor"
  /** Whether the link is an image. */
  image: boolean
  /** For internal links: `absolute` (starts with `/`, bundle-relative) or `relative`. */
  form?: "absolute" | "relative"
  /** For internal links: the bundle-relative path the link resolves to
   * (directories have no trailing slash). */
  resolved?: string
  /** For internal links: the target exists as a file or directory. */
  exists?: boolean
  /** For internal links: the target is a directory. */
  directory?: boolean
  /** For internal links: the path climbs above the bundle root. */
  outside?: boolean
  /** For internal links to a concept: its concept ID. */
  concept?: string
}

/** A markdown footnote reference (`[^label]`), the join key into `sources` ids. */
export interface FootnoteReference {
  label: string
  line: number
  column: number
}

/** A fenced or indented code block. */
export interface CodeBlock {
  /** The info-string language (`d2`, `mermaid`, `sql`, ...), if any. */
  lang?: string
  value: string
  /** Line of the opening fence (or first line, for indented code). */
  line: number
  /** Line of the first line of code content. */
  contentLine: number
}

/** What every markdown file in a tree has in common. */
export interface MarkdownFile {
  /** Bundle-relative POSIX path, e.g. `tables/orders.md`. */
  path: string
  /** The file's text with any byte-order mark removed and CRLF normalized to LF. */
  text: string
  /** The parsed frontmatter mapping; `undefined` when there is no block or it
   * could not be parsed into a mapping. An empty block is `{}`. */
  frontmatter: Record<string, unknown> | undefined
  /** Whether the file starts with a `---` frontmatter block (parseable or not). */
  hasFrontmatter: boolean
  /** Why the frontmatter block could not be read, if it couldn't. */
  frontmatterError?: Diagnostic
  /** First line after the frontmatter block (1 when there is none). */
  bodyStartLine: number
  /** The body as mdast, with positions relative to the whole file. */
  ast: Root
  links: Link[]
  footnotes: FootnoteReference[]
  codeBlocks: CodeBlock[]
  /** Where a frontmatter key (or sequence item) is written, if present. */
  locate(path: KeyPath): Position | undefined
}

/** An entry of a concept's `sources` list (spec §5.1). Fields hold the values
 * as written when they have the expected type, and are absent otherwise. */
export interface Source {
  id?: string
  resource?: string
  title?: string
  author?: string
  usageCount?: number
  lastModified?: string
}

/** A verification event (spec §5.2). */
export interface Verification {
  by: string
  at?: string
}

/** A concept document: any non-reserved `.md` file. */
export interface Concept extends MarkdownFile {
  kind: "concept"
  /** Concept ID: the path without the `.md` suffix (spec §2). */
  id: string
  type?: string
  title?: string
  description?: string
  resource?: string
  tags: string[]
  /** Lifecycle status; `stable` when absent or not a recognized value. */
  status: Status
  generated?: { by?: string; at?: string }
  /** Verification events, with a bare mapping treated as a one-element list. */
  verified: Verification[]
  trustTier: TrustTier
  staleAfter?: string
  sources: Source[]
  /** Whether `now >= stale_after` (spec §5.5). False when there is no valid `stale_after`. */
  isStale(now?: Date): boolean
}

/** A reserved file: `index.md` (spec §8) or `log.md` (spec §9). */
export interface ReservedFile extends MarkdownFile {
  kind: "index" | "log"
  /** Bundle-relative directory the file describes (`""` for the root). */
  directory: string
}

/** `.okforest/tree.yaml`, OKForest's per-tree settings (not part of OKF). */
export interface TreeSettings {
  path: string
  text: string
  /** The parsed mapping; `undefined` if it could not be parsed into one. */
  data: Record<string, unknown> | undefined
  error?: Diagnostic
  /** Validation ignore globs (`ignore:`), when well-formed. */
  ignore: string[]
  locate(path: KeyPath): Position | undefined
}

/** A tree (an OKF bundle) read into a model. */
export interface Tree {
  /** Every file path in the tree, sorted. */
  files: string[]
  /** Concepts, sorted by path. */
  concepts: Concept[]
  /** `index.md` and `log.md` files, sorted by path. */
  reserved: ReservedFile[]
  /** Markdown files skipped as repository files or by `ignore:` settings. */
  ignored: string[]
  settings?: TreeSettings
  /** The bundle-root `index.md` `okf_version` value, as written. */
  okfVersion?: unknown
  /** Every link in every markdown file, in path and position order. */
  links: Link[]
  /** Look up a concept by its concept ID. */
  concept(id: string): Concept | undefined
  /** Links from concepts (not from `index.md` or `log.md`) to the given concept. */
  backlinks(id: string): Link[]
}
