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

/** Trust tier, derived from a concept's current `verified` events (spec §5.3). */
export type TrustTier = "unverified" | "machine-confirmed" | "human-reviewed"

/** A lifecycle status OKF defines (spec §5.4). */
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
  /** For internal links to a concept: its concept ID. Read a file at a time
   * ({@link TreeOutline.read}), it's the ID the target's path gives, since
   * under OKF 0.3 whether that file is a concept isn't known until it's read
   * (it may be an {@link OtherMarkdown}); a {@link Tree} keeps it only for
   * concepts. */
  concept?: string
  /** For a path field (spec §6.2) rather than a link in the body: the
   * frontmatter key it's written in, such as `superseded_by` or
   * `sources[0].resource`. */
  field?: string
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

/** A verification event (spec §5.2). Only an event with a timestamp `at`
 * counts toward the trust tier. */
export interface Verification {
  by: string
  at?: string
}

/** A bundle's own metadata, from its root `index.md` (spec §8.1, OKF 0.3). */
export interface BundleMetadata {
  title?: string
  description?: string
  /** An SPDX expression, or a path to a license file in the bundle. */
  license?: string
}

/** A concept document: a `.md` file other than `index.md` and `log.md`.
 * Under OKF 0.3 only one whose frontmatter has a non-empty `type` is one
 * (spec §3.2); the rest are {@link OtherMarkdown}. */
export interface Concept extends MarkdownFile {
  kind: "concept"
  /** Concept ID: the path without the `.md` suffix (spec §2). */
  id: string
  type?: string
  title?: string
  description?: string
  resource?: string
  tags: string[]
  /** Lifecycle status (spec §5.4): `stable` when absent; `unrecognized`
   * for a value OKF doesn't define, which isn't `stable` ({@link statusValue}
   * has it as written). */
  status: Status | "unrecognized"
  /** The `status` as written, when it's one OKF doesn't define. */
  statusValue?: string
  /** The concept that replaces this one, as written (spec §5.4); it means
   * something only with `status: deprecated`. {@link paths} resolves it. */
  supersededBy?: string
  generated?: { by?: string; at?: string }
  /** Verification events, with a bare mapping treated as a one-element list. */
  verified: Verification[]
  /** The events from before the content last changed (`generated.at`):
   * history, which no longer counts toward the trust tier (spec §5.3). */
  verifiedBefore: Verification[]
  /** From the current verification events only (spec §5.3). */
  trustTier: TrustTier
  /** `stale_after` as written, when it isn't absent. */
  staleAfter?: string
  sources: Source[]
  /** Its path fields (spec §6.2): `resource`, `sources[].resource`,
   * `superseded_by`, `computation`, `executor.resource`, and
   * `attester.resource`, resolved as links are, each with its `field`. Those
   * that resolve to a concept are edges of the bundle graph (§6.4), as body
   * links are. */
  paths: Link[]
  /** Whether `now >= stale_after` (spec §5.5). False when it's absent; true
   * when it isn't a timestamp, which can't say the content is still current. */
  isStale(now?: Date): boolean
}

/** A reserved markdown file: `index.md` (spec §8) or `log.md` (spec §9). */
export interface ReservedMarkdown extends MarkdownFile {
  kind: "index" | "log"
  /** Bundle-relative directory the file describes (`""` for the root). */
  directory: string
}

/** A markdown file that isn't a concept, `index.md`, or `log.md`: under OKF
 * 0.3, one without frontmatter or a non-empty `type` (spec §3.2), such as a
 * `README.md`. Consumers skip it: it isn't listed, searched, or linked to as
 * a concept. Under OKF 0.2, or no version, every such file is a
 * {@link Concept}. */
export interface OtherMarkdown extends MarkdownFile {
  kind: "other"
}

/** `.okforest/settings.yaml`, OKForest's settings for a bundle (not part of OKF). */
export interface TreeSettings {
  path: string
  text: string
  /** The parsed mapping; `undefined` if it could not be parsed into one. */
  data: Record<string, unknown> | undefined
  error?: Diagnostic
  /** Validation ignore globs (`ignore:`), when well-formed. */
  ignore: string[]
  /** The bundle's name (`name:`), when it is non-blank text. */
  name?: string
  /** What the bundle covers (`description:`), when it is non-blank text. */
  description?: string
  /** How OKForest draws the bundle's diagrams (`diagrams:`): the settings
   * that are well formed, when there are any. */
  diagrams?: DiagramSettings
  locate(path: KeyPath): Position | undefined
}

/** `diagrams:` in `.okforest/settings.yaml`: a section per diagram
 * language. */
export interface DiagramSettings {
  mermaid?: {
    /** What draws ```mermaid blocks: Mermaid itself, or Pele
     * (https://pele.run), a Mermaid renderer of its own. OKForest uses
     * Mermaid when unset. */
    renderer?: MermaidRenderer
  }
}

/** A `diagrams.mermaid.renderer` (MERMAID_RENDERERS). */
export type MermaidRenderer = "mermaid" | "pele"

/** A JSON Schema for the frontmatter of one type's concepts, at
 * `.okforest/types/<type>.schema.json` (an OKForest convention, not OKF). */
export interface TypeSchema {
  path: string
  text: string
  /** The parsed JSON; `undefined` if it isn't valid JSON. */
  data: unknown
  error?: Diagnostic
  /** The type it's for: its `title`, when that is non-blank text. */
  name?: string
  /** Where a key of the schema is written, if present. */
  locate(path: KeyPath): Position | undefined
}

/** A type's starter page, at `.okforest/types/<type>.template.md` (an
 * OKForest convention, not OKF): what a new concept of the type starts as,
 * front matter and body, in the template's own order. Never a concept. */
export interface TypeTemplate {
  path: string
  /** The file's text with any byte-order mark removed and CRLF normalized to LF. */
  text: string
  /** Its front matter, as a concept's is read; `undefined` when there is no
   * block or it isn't a mapping. */
  frontmatter: Record<string, unknown> | undefined
  /** Whether it starts with a `---` front matter block (parseable or not). */
  hasFrontmatter: boolean
  /** Why its front matter could not be read, if it couldn't. */
  frontmatterError?: Diagnostic
  /** The type it's for: its `type`, when that is non-blank text. */
  name?: string
  /** Where a key of its front matter is written, if present. */
  locate(path: KeyPath): Position | undefined
}

/**
 * A tree without its documents: every path in it, the markdown files that are
 * part of it, its settings, type schemas, and type templates, worked out from paths alone
 * (and the text of those files). A tree too large to hold parsed at once is read one file at a
 * time with {@link TreeOutline.read}; {@link Tree} is the same, read whole.
 */
export interface TreeOutline {
  /** Every file path in the tree, sorted. */
  files: string[]
  /** The markdown files that are part of the tree, sorted: its concepts,
   * `index.md`, and `log.md` files, and under OKF 0.3 those that aren't
   * concepts ({@link OtherMarkdown}), without those the settings ignore. */
  markdown: string[]
  /** Markdown files left out by the settings' `ignore:` globs. */
  ignored: string[]
  settings?: TreeSettings
  /** Its type schemas whose text was given, sorted by path. */
  types: TypeSchema[]
  /** Its type templates whose text was given, sorted by path. */
  templates: TypeTemplate[]
  /** The bundle-root `index.md` `okf_version` value, as written, when it
   * was given (spec §12): it decides which version's rules apply. */
  okfVersion?: unknown
  /** Read one of {@link markdown}, with its links resolved against the whole
   * tree, as {@link Tree} holds it: under OKF 0.3, a file without a `type`
   * is an {@link OtherMarkdown}, which isn't a concept. Throws for any other path. */
  read(path: string, text: string): Concept | ReservedMarkdown | OtherMarkdown
}

/** A tree (an OKF bundle) read into a model. */
export interface Tree {
  /** Every file path in the tree, sorted. */
  files: string[]
  /** Concepts, sorted by path. */
  concepts: Concept[]
  /** `index.md` and `log.md` files, sorted by path. */
  reserved: ReservedMarkdown[]
  /** Markdown files that aren't concepts (OKF 0.3 §3.2: no frontmatter or
   * no `type`), sorted by path; always empty under 0.2. */
  otherMarkdown: OtherMarkdown[]
  /** Markdown files left out by the settings' `ignore:` globs. */
  ignored: string[]
  settings?: TreeSettings
  /** Its type schemas, sorted by path. */
  types: TypeSchema[]
  /** Its type templates, sorted by path. */
  templates: TypeTemplate[]
  /** The bundle-root `index.md` `okf_version` value, as written. */
  okfVersion?: unknown
  /** The bundle's metadata from its root `index.md` (spec §8.1), when it
   * gives any. */
  metadata?: BundleMetadata
  /** Every link in every markdown file, in path and position order. */
  links: Link[]
  /** Look up a concept by its concept ID. */
  concept(id: string): Concept | undefined
  /** Links and path fields from concepts (not from `index.md` or `log.md`)
   * to the given concept: its incoming edges in the bundle graph (spec §6.4). */
  backlinks(id: string): Link[]
}
