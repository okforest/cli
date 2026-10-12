import { type ParsedFile, readMarkdownFile } from "./document.js"
import type { RawLink } from "./markdown.js"
import { basename, dirname, globToRegExp, isExternal, normalize } from "./paths.js"
import {
  deriveStatus,
  deriveTrustTier,
  isStaleAt,
  normalizeSources,
  normalizeVerified,
} from "./trust.js"
import type { Concept, Link, ReservedFile, Tree, TreeFile, TreeSettings } from "./types.js"
import { isRecord, parseYaml } from "./yaml.js"

/** Where OKForest keeps per-tree settings (an OKForest convention, not OKF). */
export const SETTINGS_PATH = ".okforest/tree.yaml"

/**
 * Repository files at the tree root that are not concepts, though the OKF
 * spec letter would make them so. Matched case-insensitively. Extend per tree
 * with `ignore:` globs in `.okforest/tree.yaml`.
 */
export const DEFAULT_IGNORED: readonly string[] = [
  "README.md",
  "LICENSE.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
]

const RESERVED = new Set(["index.md", "log.md"])

/**
 * Build a {@link Tree} from files. Pure: no file system access, so the same
 * code runs in Node, browsers, and Workers (see `@okforest/okf/node` for
 * reading a directory). Never throws on malformed content; problems are
 * recorded on the files for `@okforest/validate` to report.
 *
 * Markdown files under hidden directories (any path segment starting with
 * `.`) and `node_modules` are not part of the tree.
 */
export function parseTree(input: Iterable<TreeFile>): Tree {
  const texts = new Map<string, string | undefined>()
  for (const file of input) {
    const path = normalize(file.path.replaceAll("\\", "/"))
    if (path) texts.set(path, file.text)
  }
  const files = [...texts.keys()].sort()
  const fileSet = new Set(files)
  const directories = new Set<string>([""])
  for (const path of files) {
    for (let dir = dirname(path); dir !== ""; dir = dirname(dir)) directories.add(dir)
  }

  const settings = readSettings(texts.get(SETTINGS_PATH))
  const ignorePatterns = (settings?.ignore ?? []).map(globToRegExp)
  const defaultIgnored = new Set(DEFAULT_IGNORED.map((name) => name.toLowerCase()))

  const ignored: string[] = []
  const parsed: { file: ParsedFile; reserved: boolean }[] = []
  for (const path of files) {
    if (!path.endsWith(".md")) continue
    const segments = path.split("/")
    if (segments.some((s) => s.startsWith(".") || s === "node_modules")) continue
    if (
      (segments.length === 1 && defaultIgnored.has(path.toLowerCase())) ||
      ignorePatterns.some((pattern) => pattern.test(path))
    ) {
      ignored.push(path)
      continue
    }
    parsed.push({
      file: readMarkdownFile(path, texts.get(path) ?? ""),
      reserved: RESERVED.has(basename(path)),
    })
  }

  const conceptIds = new Set(
    parsed.filter((p) => !p.reserved).map((p) => p.file.path.slice(0, -".md".length)),
  )
  const resolve = (raw: RawLink, from: string): Link =>
    resolveLink(raw, from, fileSet, directories, conceptIds)

  const concepts: Concept[] = []
  const reserved: ReservedFile[] = []
  for (const { file, reserved: isReserved } of parsed) {
    const { rawLinks, ...rest } = file
    const links = rawLinks.map((raw) => resolve(raw, file.path))
    if (isReserved) {
      reserved.push({
        ...rest,
        links,
        kind: basename(file.path) === "index.md" ? "index" : "log",
        directory: dirname(file.path),
      })
    } else {
      concepts.push(buildConcept({ ...rest, links }))
    }
  }

  const byId = new Map(concepts.map((c) => [c.id, c]))
  const backlinks = new Map<string, Link[]>()
  for (const concept of concepts) {
    for (const link of concept.links) {
      if (!link.concept) continue
      const list = backlinks.get(link.concept) ?? []
      list.push(link)
      backlinks.set(link.concept, list)
    }
  }
  const rootIndex = reserved.find((r) => r.path === "index.md")

  return {
    files,
    concepts,
    reserved,
    ignored,
    ...(settings ? { settings } : {}),
    ...(rootIndex?.frontmatter && "okf_version" in rootIndex.frontmatter
      ? { okfVersion: rootIndex.frontmatter.okf_version }
      : {}),
    links: [...concepts, ...reserved]
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      .flatMap((doc) => doc.links),
    concept: (id) => byId.get(id),
    backlinks: (id) => backlinks.get(id) ?? [],
  }
}

function buildConcept(file: Omit<Concept, keyof ConceptFields>): Concept {
  const fm = file.frontmatter ?? {}
  const str = (key: string) => {
    const value = fm[key]
    return typeof value === "string" && value.trim() !== "" ? value : undefined
  }
  const verified = normalizeVerified(fm.verified)
  const staleAfter = str("stale_after")
  const generated = isRecord(fm.generated)
    ? {
        ...(typeof fm.generated.by === "string" ? { by: fm.generated.by } : {}),
        ...(typeof fm.generated.at === "string" ? { at: fm.generated.at } : {}),
      }
    : undefined
  const tags = Array.isArray(fm.tags)
    ? fm.tags.filter((t): t is string => typeof t === "string")
    : typeof fm.tags === "string"
      ? [fm.tags]
      : []
  const fields: ConceptFields = {
    kind: "concept",
    id: file.path.slice(0, -".md".length),
    tags,
    status: deriveStatus(fm.status),
    verified,
    trustTier: deriveTrustTier(verified),
    sources: normalizeSources(fm.sources),
    isStale: (now = new Date()) => isStaleAt(staleAfter, now),
  }
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
  | "generated"
  | "verified"
  | "trustTier"
  | "staleAfter"
  | "sources"
  | "isStale"
>

function resolveLink(
  raw: RawLink,
  from: string,
  files: ReadonlySet<string>,
  directories: ReadonlySet<string>,
  conceptIds: ReadonlySet<string>,
): Link {
  const base = { from, target: raw.target, line: raw.line, column: raw.column, image: raw.image }
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

function readSettings(text: string | undefined): TreeSettings | undefined {
  if (text === undefined) return undefined
  const parsed = parseYaml(text.replace(/^﻿/, "").replace(/\r\n?/g, "\n"), 1)
  const data = parsed.value === null ? {} : isRecord(parsed.value) ? parsed.value : undefined
  const ignore = Array.isArray(data?.ignore)
    ? data.ignore.filter((g): g is string => typeof g === "string" && g.trim() !== "")
    : []
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
    locate: parsed.locate,
  }
}
