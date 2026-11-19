import { readMarkdownFile } from "./document.js"
import type { RawLink } from "./markdown.js"
import { basename, dirname, globToRegExp, isExternal, normalize } from "./paths.js"
import {
  currentVerifications,
  deriveStatus,
  deriveTrustTier,
  isAbsent,
  isStaleAt,
  normalizeSources,
  normalizeVerified,
} from "./trust.js"
import type {
  BundleMetadata,
  Concept,
  Diagnostic,
  DiagramSettings,
  Link,
  MermaidRenderer,
  ReservedFile,
  Tree,
  TreeFile,
  TreeOutline,
  TreeSettings,
  TypeSchema,
  TypeTemplate,
} from "./types.js"
import { okfVersionAtLeast } from "./version.js"
import { isRecord, parseYaml } from "./yaml.js"

/** Where OKForest keeps a bundle's settings (an OKForest convention, not OKF). */
export const SETTINGS_PATH = ".okforest/settings.yaml"

/** What may draw a bundle's ```mermaid blocks (`diagrams.mermaid.renderer`
 * in its settings). */
export const MERMAID_RENDERERS: readonly MermaidRenderer[] = ["mermaid", "pele"]

/** Where OKForest keeps a bundle's type schemas, one `<type>.schema.json` a
 * type (an OKForest convention, not OKF). */
export const TYPES_FOLDER = ".okforest/types/"

/** Whether a bundle path is a type schema: a `.schema.json` file in
 * {@link TYPES_FOLDER}, the name editors check as a JSON Schema. */
export function isTypeSchemaPath(path: string): boolean {
  return path.startsWith(TYPES_FOLDER) && path.endsWith(".schema.json")
}

/** Whether a bundle path is a type template: a `.template.md` file in
 * {@link TYPES_FOLDER}, the page a new concept of its type starts as. */
export function isTypeTemplatePath(path: string): boolean {
  return path.startsWith(TYPES_FOLDER) && path.endsWith(".template.md")
}

/** Whether a bundle path is a type schema or template, whose text
 * {@link outlineTree} needs. */
export function isTypeFilePath(path: string): boolean {
  return isTypeSchemaPath(path) || isTypeTemplatePath(path)
}

const RESERVED = new Set(["index.md", "log.md"])

/**
 * Build a {@link Tree} from files. Pure: no file system access, so the same
 * code runs in Node, browsers, and Workers (see `@okforest/okf/node` for
 * reading a directory). Never throws on malformed content; problems are
 * recorded on the files for `@okforest/validate` to report.
 *
 * Every markdown file is part of the tree except those in a file or folder
 * whose name starts with `.` (`.okforest/`, `.git/`, `.github/`), as OKF
 * says (§3.2); settings `ignore:` globs leave out others.
 */
export function parseTree(input: Iterable<TreeFile>): Tree {
  const texts = new Map<string, string | undefined>()
  for (const file of input) {
    const path = normalize(file.path.replaceAll("\\", "/"))
    if (path) texts.set(path, file.text)
  }
  const typeTexts = new Map<string, string>()
  for (const [path, text] of texts) {
    if (text !== undefined && isTypeFilePath(path)) typeTexts.set(path, text)
  }
  const rootText = texts.get("index.md")
  const okfVersion =
    rootText === undefined
      ? undefined
      : readMarkdownFile("index.md", rootText).frontmatter?.okf_version
  const outline = outlineTree(texts.keys(), texts.get(SETTINGS_PATH), typeTexts, { okfVersion })
  const concepts: Concept[] = []
  const reserved: ReservedFile[] = []
  for (const path of outline.markdown) {
    const file = outline.read(path, texts.get(path) ?? "")
    if (file.kind === "concept") concepts.push(file)
    else reserved.push(file)
  }

  const byId = new Map(concepts.map((c) => [c.id, c]))
  const backlinks = new Map<string, Link[]>()
  for (const concept of concepts) {
    for (const link of [...concept.links, ...concept.paths]) {
      if (!link.concept) continue
      const list = backlinks.get(link.concept) ?? []
      list.push(link)
      backlinks.set(link.concept, list)
    }
  }
  const rootIndex = reserved.find((r) => r.path === "index.md")
  const metadata = readBundleMetadata(rootIndex?.frontmatter)

  return {
    files: outline.files,
    concepts,
    reserved,
    ignored: outline.ignored,
    ...(outline.settings ? { settings: outline.settings } : {}),
    types: outline.types,
    templates: outline.templates,
    ...(rootIndex?.frontmatter && "okf_version" in rootIndex.frontmatter
      ? { okfVersion: rootIndex.frontmatter.okf_version }
      : {}),
    ...(metadata ? { metadata } : {}),
    links: [...concepts, ...reserved]
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      .flatMap((doc) => doc.links),
    concept: (id) => byId.get(id),
    backlinks: (id) => backlinks.get(id) ?? [],
  }
}

/**
 * Outline a tree from its file paths, the text of its settings file
 * (`.okforest/settings.yaml`, when it has one), and the texts of its type
 * schemas and templates by path ({@link isTypeFilePath}), without reading its markdown:
 * a tree too large to hold parsed at once is then read one file at a time
 * with {@link TreeOutline.read}, each file as {@link parseTree} reads it.
 * `okfVersion`, the root `index.md`'s, decides how path fields resolve (a
 * bundle on 0.2 or no version may resolve them from the bundle root, §6.2).
 */
export function outlineTree(
  paths: Iterable<string>,
  settingsText?: string,
  typeTexts: ReadonlyMap<string, string> = new Map(),
  options: { okfVersion?: unknown } = {},
): TreeOutline {
  const unique = new Set<string>()
  for (const raw of paths) {
    const path = normalize(raw.replaceAll("\\", "/"))
    if (path) unique.add(path)
  }
  const files = [...unique].sort()
  const fileSet = new Set(files)
  const directories = new Set<string>([""])
  for (const path of files) {
    for (let dir = dirname(path); dir !== ""; dir = dirname(dir)) directories.add(dir)
  }

  const settings = readSettings(settingsText)
  const isIgnored = ignoreMatcher(settings?.ignore ?? [])

  const ignored: string[] = []
  const markdown: string[] = []
  for (const path of files) {
    if (!path.endsWith(".md")) continue
    if (path.split("/").some((segment) => segment.startsWith("."))) continue
    if (isIgnored(path)) ignored.push(path)
    else markdown.push(path)
  }
  const inTree = new Set(markdown)
  const conceptIds = new Set(
    markdown.filter((path) => !RESERVED.has(basename(path))).map((path) => path.slice(0, -3)),
  )

  const typeTextOf = new Map(
    [...typeTexts].map(([path, text]) => [normalize(path.replaceAll("\\", "/")), text]),
  )
  const types = files.flatMap((path) => {
    const text = typeTextOf.get(path)
    return text !== undefined && isTypeSchemaPath(path) ? [readTypeSchema(path, text)] : []
  })
  const templates = files.flatMap((path) => {
    const text = typeTextOf.get(path)
    return text !== undefined && isTypeTemplatePath(path) ? [readTypeTemplate(path, text)] : []
  })

  return {
    files,
    markdown,
    ignored,
    ...(settings ? { settings } : {}),
    types,
    templates,
    read(path, text) {
      if (!inTree.has(path)) throw new Error(`${path} is not one of the tree's markdown files.`)
      const { rawLinks, ...rest } = readMarkdownFile(path, text)
      const resolve = (raw: RawLink, from = path) =>
        resolveLink(raw, from, fileSet, directories, conceptIds)
      const links = rawLinks.map((raw) => resolve(raw))
      const name = basename(path)
      if (!RESERVED.has(name)) {
        const legacy = !okfVersionAtLeast(options.okfVersion, "0.3")
        return buildConcept({ ...rest, links }, (raw) => {
          const link = resolve(raw)
          if (!legacy || link.kind !== "internal" || link.form !== "relative" || link.exists) {
            return link
          }
          // OKF 0.2 wrote path fields from the bundle root (§12.1).
          const rooted = resolve(raw, basename(path))
          return rooted.exists ? { ...rooted, from: path } : link
        })
      }
      return {
        ...rest,
        links,
        kind: name === "index.md" ? "index" : "log",
        directory: dirname(path),
      }
    },
  }
}

function buildConcept(
  file: Omit<Concept, keyof ConceptFields>,
  resolvePath: (raw: RawLink) => Link,
): Concept {
  const fm = file.frontmatter ?? {}
  const str = (key: string) => {
    const value = fm[key]
    return typeof value === "string" && value.trim() !== "" ? value : undefined
  }
  const verified = normalizeVerified(fm.verified)
  const staleAfter = isAbsent(fm.stale_after) ? undefined : String(fm.stale_after)
  const generated = isRecord(fm.generated)
    ? {
        ...(typeof fm.generated.by === "string" ? { by: fm.generated.by } : {}),
        ...(typeof fm.generated.at === "string" ? { at: fm.generated.at } : {}),
      }
    : undefined
  // One tag is a list of one, never split at commas (§11.2).
  const tags = (Array.isArray(fm.tags) ? fm.tags : [fm.tags]).filter(
    (t): t is string => typeof t === "string" && t.trim() !== "",
  )
  const status = deriveStatus(fm.status)
  const current = new Set(currentVerifications(verified, generated?.at))
  const fields: ConceptFields = {
    kind: "concept",
    id: file.path.slice(0, -".md".length),
    tags,
    status,
    verified,
    verifiedBefore: verified.filter((v) => !current.has(v) && v.at !== undefined),
    trustTier: deriveTrustTier(verified, generated?.at),
    sources: normalizeSources(fm.sources),
    paths: pathFields(fm, file.locate).map(resolvePath),
    isStale: (now = new Date()) => isStaleAt(staleAfter, now),
  }
  if (status === "unrecognized") fields.statusValue = String(fm.status)
  const supersededBy = str("superseded_by")
  if (supersededBy !== undefined) fields.supersededBy = supersededBy
  for (const key of ["type", "title", "description", "resource"] as const) {
    const value = str(key)
    if (value !== undefined) fields[key] = value
  }
  if (staleAfter !== undefined) fields.staleAfter = staleAfter
  if (generated) fields.generated = generated
  return { ...file, ...fields }
}

type ConceptFields = Pick<
  Concept,
  | "kind"
  | "id"
  | "type"
  | "title"
  | "description"
  | "resource"
  | "tags"
  | "status"
  | "statusValue"
  | "supersededBy"
  | "generated"
  | "verified"
  | "verifiedBefore"
  | "trustTier"
  | "staleAfter"
  | "sources"
  | "paths"
  | "isStale"
>

/**
 * A concept's path fields (spec §6.2), unresolved, each with its key and
 * where it's written. A `sources` entry's `resource` may describe a scope
 * (`all queries in project X`) rather than name a file (§5.1): one with
 * whitespace isn't a path, since a path percent-encodes its spaces (§6).
 */
function pathFields(
  fm: Record<string, unknown>,
  locate: Concept["locate"],
): (RawLink & { field: string })[] {
  const found: (RawLink & { field: string })[] = []
  const add = (keys: (string | number)[], value: unknown, field: string) => {
    if (typeof value !== "string" || value.trim() === "") return
    const at = locate(keys) ?? { line: 1, column: 1 }
    found.push({ target: value, line: at.line, column: at.column, image: false, field })
  }
  for (const key of ["resource", "superseded_by", "computation"]) add([key], fm[key], key)
  for (const key of ["executor", "attester"]) {
    const value = fm[key]
    if (isRecord(value)) add([key, "resource"], value.resource, `${key}.resource`)
  }
  const sources = fm.sources
  const entries = Array.isArray(sources) ? sources : isRecord(sources) ? [sources] : []
  entries.forEach((entry, i) => {
    if (
      !isRecord(entry) ||
      typeof entry.resource !== "string" ||
      /\s/.test(entry.resource.trim())
    ) {
      return
    }
    const keys = Array.isArray(sources) ? ["sources", i, "resource"] : ["sources", "resource"]
    add(
      keys,
      entry.resource,
      Array.isArray(sources) ? `sources[${i}].resource` : "sources.resource",
    )
  })
  return found
}

/** A bundle's metadata from its root `index.md`'s frontmatter (spec §8.1):
 * `title`, `description`, and `license`, when they're non-blank text. */
export function readBundleMetadata(
  frontmatter: Record<string, unknown> | undefined,
): BundleMetadata | undefined {
  const metadata: BundleMetadata = {}
  for (const key of ["title", "description", "license"] as const) {
    const value = frontmatter?.[key]
    if (typeof value === "string" && value.trim() !== "") metadata[key] = value
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined
}

function resolveLink(
  raw: RawLink & { field?: string },
  from: string,
  files: ReadonlySet<string>,
  directories: ReadonlySet<string>,
  conceptIds: ReadonlySet<string>,
): Link {
  const base = {
    from,
    target: raw.target,
    line: raw.line,
    column: raw.column,
    image: raw.image,
    ...(raw.field !== undefined ? { field: raw.field } : {}),
  }
  const target = raw.target.trim()
  if (isExternal(target)) return { ...base, kind: "external" }
  let path = target.replace(/[?#].*$/, "")
  if (path === "") return { ...base, kind: "anchor" }
  try {
    path = decodeURIComponent(path)
  } catch {
    // Keep malformed percent-encoding as written.
  }
  const form = path.startsWith("/") ? "absolute" : "relative"
  const resolved = form === "absolute" ? normalize(path) : normalize(dirname(from), path)
  if (resolved === undefined) {
    return { ...base, kind: "internal", form, exists: false, outside: true }
  }
  const isFile = files.has(resolved)
  const isDirectory = !isFile && directories.has(resolved)
  const id = resolved.endsWith(".md") ? resolved.slice(0, -".md".length) : undefined
  return {
    ...base,
    kind: "internal",
    form,
    resolved,
    exists: isFile || isDirectory,
    ...(isDirectory ? { directory: true } : {}),
    ...(id !== undefined && conceptIds.has(id) ? { concept: id } : {}),
  }
}

/** Whether a bundle path matches one of the settings' `ignore:` globs. */
export function ignoreMatcher(globs: readonly string[]): (path: string) => boolean {
  const patterns = globs.map(globToRegExp)
  return (path) => patterns.some((pattern) => pattern.test(path))
}

/** `.okforest/settings.yaml`, read leniently: what the `okforest/settings`
 * rule reports as malformed is left out of `ignore`, `name`,
 * `description`, and `diagrams`. */
export function readSettings(text: string | undefined): TreeSettings | undefined {
  if (text === undefined) return undefined
  const parsed = parseYaml(text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"), 1)
  const data = parsed.value === null ? {} : isRecord(parsed.value) ? parsed.value : undefined
  const ignore = Array.isArray(data?.ignore)
    ? data.ignore.filter((g): g is string => typeof g === "string" && g.trim() !== "")
    : []
  const nonBlank = (key: string) => {
    const value = data?.[key]
    return typeof value === "string" && value.trim() !== "" ? value : undefined
  }
  const name = nonBlank("name")
  const description = nonBlank("description")
  const diagrams = readDiagrams(data?.diagrams)
  const error =
    parsed.error ??
    (data === undefined
      ? { message: "Settings must be a YAML mapping.", line: 1, column: 1 }
      : undefined)
  return {
    path: SETTINGS_PATH,
    text,
    data,
    ...(error ? { error } : {}),
    ignore,
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(diagrams ? { diagrams } : {}),
    locate: parsed.locate,
  }
}

/** `diagrams:`, keeping only what's well formed; undefined when that's
 * nothing. */
function readDiagrams(value: unknown): DiagramSettings | undefined {
  const mermaid = isRecord(value) ? value.mermaid : undefined
  const renderer = isRecord(mermaid) ? mermaid.renderer : undefined
  return MERMAID_RENDERERS.includes(renderer as MermaidRenderer)
    ? { mermaid: { renderer: renderer as MermaidRenderer } }
    : undefined
}

/** A type schema file, read leniently: what the `okforest/type-schema` rule
 * reports (text that isn't JSON) leaves `data` undefined. Keys are located
 * by reading the text as YAML, which JSON is. */
export function readTypeSchema(path: string, text: string): TypeSchema {
  const source = text.replace(/^﻿/, "")
  const { locate } = parseYaml(source.replace(/\r\n?/g, "\n"), 1)
  let data: unknown
  let error: Diagnostic | undefined
  try {
    data = JSON.parse(source)
  } catch (cause) {
    error = jsonError(source, cause)
  }
  const title = isRecord(data) ? data.title : undefined
  const name = typeof title === "string" && title.trim() !== "" ? title : undefined
  return {
    path,
    text,
    data,
    ...(error ? { error } : {}),
    ...(name !== undefined ? { name } : {}),
    locate,
  }
}

/** A type template, its front matter read as a concept's is. */
export function readTypeTemplate(path: string, text: string): TypeTemplate {
  const file = readMarkdownFile(path, text)
  const type = file.frontmatter?.type
  return {
    path,
    text: file.text,
    frontmatter: file.frontmatter,
    hasFrontmatter: file.hasFrontmatter,
    ...(file.frontmatterError ? { frontmatterError: file.frontmatterError } : {}),
    ...(typeof type === "string" && type.trim() !== "" ? { name: type } : {}),
    locate: file.locate,
  }
}

/** Where `JSON.parse` stopped, from the offset in its message ("Expected ','
 * after property value in JSON at position 42"); the start when it gives
 * none ("Unexpected end of JSON input"). */
function jsonError(source: string, cause: unknown): Diagnostic {
  const message = cause instanceof Error ? cause.message : String(cause)
  const reason = message.replace(/\s+in JSON at position \d+.*$/, "").replace(/\.?$/, ".")
  const offset = /at position (\d+)/.exec(message)
  const at = offset ? positionAt(source, Number(offset[1])) : { line: 1, column: 1 }
  return { message: `Not valid JSON: ${reason}`, ...at }
}

function positionAt(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset).split("\n")
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 }
}
