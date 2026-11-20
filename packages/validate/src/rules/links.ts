import { type Concept, isRecord, type KeyPath } from "@okforest/okf"
import type { CheckContext, Rule } from "../types.js"
import { at, isOkf03, show } from "../util.js"

/**
 * Path-valued frontmatter fields (OKF §6.2): those written explicitly as
 * `/…`, `./…`, or `../…`, and under OKF 0.3 a bare one too, which resolves
 * from the concept's folder. Under 0.2 a bare `skills/run.md` is ambiguous
 * (Google's 0.2 samples wrote bundle-root paths that way, which 0.3 lets a
 * 0.2 bundle keep, §12.1), so it's left alone. A `sources[].resource` may be
 * a scope descriptor rather than a path (§5.1), so only its explicit forms
 * are checked; a value with a URI scheme is never a path.
 */
function pathFields(concept: Concept, okf03: boolean): { value: string; path: KeyPath }[] {
  const fm = concept.frontmatter ?? {}
  const fields: { value: unknown; path: KeyPath; bare?: boolean }[] = [
    { value: fm.resource, path: ["resource"], bare: okf03 },
    { value: fm.computation, path: ["computation"], bare: okf03 },
    { value: fm.superseded_by, path: ["superseded_by"], bare: okf03 },
  ]
  for (const key of ["executor", "attester"]) {
    const value = fm[key]
    if (isRecord(value)) {
      fields.push({ value: value.resource, path: [key, "resource"], bare: okf03 })
    }
  }
  if (Array.isArray(fm.sources)) {
    fm.sources.forEach((source, i) => {
      if (isRecord(source))
        fields.push({ value: source.resource, path: ["sources", i, "resource"] })
    })
  }
  return fields.filter(
    (f): f is { value: string; path: KeyPath } =>
      typeof f.value === "string" &&
      (/^(?:\/|\.\.?\/)/.test(f.value) ||
        (f.bare === true && f.value.trim() !== "" && !/^[a-z][a-z0-9+.-]*:/i.test(f.value))),
  )
}

/** Each outline's paths, files and directories, as sets: built once a run. */
const pathSets = new WeakMap<CheckContext["outline"], ReadonlySet<string>>()

function pathsOf(outline: CheckContext["outline"]): ReadonlySet<string> {
  let paths = pathSets.get(outline)
  if (!paths) {
    const set = new Set<string>(outline.files)
    for (const file of outline.files) {
      for (let i = file.indexOf("/"); i !== -1; i = file.indexOf("/", i + 1)) {
        set.add(file.slice(0, i))
      }
    }
    paths = set
    pathSets.set(outline, paths)
  }
  return paths
}

/** Resolve an explicit path field the same way as a body link. */
function resolveField(
  concept: Concept,
  value: string,
  paths: ReadonlySet<string>,
): "ok" | "missing" | "outside" {
  const target = value.replace(/[?#].*$/, "")
  const base = target.startsWith("/") ? [] : concept.path.split("/").slice(0, -1)
  const parts = [...base]
  for (const segment of target.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") {
      if (parts.length === 0) return "outside"
      parts.pop()
    } else {
      parts.push(segment)
    }
  }
  const resolved = parts.join("/")
  return resolved === "" || paths.has(resolved) ? "ok" : "missing"
}

/** OKF §6.1: consumers tolerate broken links, so this is a warning, never an error. */
export const brokenLink: Rule = {
  id: "okf/broken-link",
  severity: "warning",
  description:
    "Links within the tree point at files that exist (a warning: OKF says never reject a bundle for broken links, §6.1, §11).",
  checkFile(file, context) {
    const { outline, report } = context
    for (const link of file.links) {
      if (link.kind !== "internal" || link.exists) continue
      report({
        file: link.from,
        line: link.line,
        column: link.column,
        message: link.outside
          ? `${show(link.target)} climbs above the tree root.`
          : `${show(link.target)} does not exist in this tree${
              link.resolved && link.resolved !== link.target
                ? ` (looked for ${show(link.resolved)})`
                : ""
            }.`,
      })
    }
    if (file.kind !== "concept") return
    for (const { value, path } of pathFields(file, isOkf03(context))) {
      const result = resolveField(file, value, pathsOf(outline))
      if (result === "ok") continue
      // OKF 0.3 resolves a bare path from the concept's folder; one written
      // from the tree's root, as 0.2's examples did, needs its leading `/`.
      const fromRoot =
        result === "missing" &&
        !/^(?:\/|\.\.?\/)/.test(value) &&
        resolveField(file, `/${value}`, pathsOf(outline)) === "ok"
      report({
        file: file.path,
        ...at(file, path),
        message:
          result === "outside"
            ? `${show(value)} climbs above the tree root.`
            : fromRoot
              ? `${show(value)} does not exist from this concept's folder, where OKF 0.3 resolves a path without a leading \`/\`; from the tree's root, write ${show(`/${value}`)}.`
              : `${show(value)} does not exist in this tree.`,
      })
    }
  },
}

/** OKF §5.1: a footnote label is the join key into `sources[].id`. */
export const footnoteSource: Rule = {
  id: "okf/footnote-source",
  severity: "warning",
  description:
    "In a concept that has `sources` with `id`s, every footnote label matches one of them (OKF §5.1 per-claim attribution).",
  checkFile(concept, { report }) {
    if (concept.kind !== "concept") return
    const ids = new Set(concept.sources.flatMap((s) => (s.id ? [s.id] : [])))
    if (ids.size === 0) return
    for (const footnote of concept.footnotes) {
      if (ids.has(footnote.label)) continue
      report({
        file: concept.path,
        line: footnote.line,
        column: footnote.column,
        message: `Footnote [^${footnote.label}] matches no \`sources\` id (${[...ids].map((id) => `\`${id}\``).join(", ")}).`,
      })
    }
  },
}
