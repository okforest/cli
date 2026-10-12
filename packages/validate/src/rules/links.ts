import { type Concept, isRecord, type KeyPath } from "@okforest/okf"
import type { Rule } from "../types.js"
import { at, show } from "../util.js"

/**
 * Path-valued frontmatter fields (OKF §6.2), checked only when written
 * explicitly as `/…`, `./…`, or `../…`. A bare `skills/run.md` is ambiguous:
 * the spec calls it relative to the concept, but Google's sample bundles
 * write bundle-root paths that way, and `sources[].resource` may also be a
 * scope descriptor rather than a path.
 */
function pathFields(concept: Concept): { value: string; path: KeyPath }[] {
  const fm = concept.frontmatter ?? {}
  const fields: { value: unknown; path: KeyPath }[] = [
    { value: fm.resource, path: ["resource"] },
    { value: fm.computation, path: ["computation"] },
  ]
  for (const key of ["executor", "attester"]) {
    const value = fm[key]
    if (isRecord(value)) fields.push({ value: value.resource, path: [key, "resource"] })
  }
  if (Array.isArray(fm.sources)) {
    fm.sources.forEach((source, i) => {
      if (isRecord(source))
        fields.push({ value: source.resource, path: ["sources", i, "resource"] })
    })
  }
  return fields.filter(
    (f): f is { value: string; path: KeyPath } =>
      typeof f.value === "string" && /^(?:\/|\.\.?\/)/.test(f.value),
  )
}

/** Resolve an explicit path field the same way as a body link. */
function resolveField(
  concept: Concept,
  value: string,
  files: ReadonlySet<string>,
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
  if (resolved === "" || files.has(resolved)) return "ok"
  const prefix = `${resolved}/`
  for (const file of files) if (file.startsWith(prefix)) return "ok"
  return "missing"
}

/** OKF §6.1: consumers tolerate broken links, so this is a warning, never an error. */
export const brokenLink: Rule = {
  id: "okf/broken-link",
  severity: "warning",
  description:
    "Links within the tree point at files that exist (a warning: OKF says never reject a bundle for broken links, §6.1, §11).",
  check({ tree, report }) {
    for (const link of tree.links) {
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
    const files = new Set(tree.files)
    for (const concept of tree.concepts) {
      for (const { value, path } of pathFields(concept)) {
        const result = resolveField(concept, value, files)
        if (result === "ok") continue
        report({
          file: concept.path,
          ...at(concept, path),
          message:
            result === "outside"
              ? `${show(value)} climbs above the tree root.`
              : `${show(value)} does not exist in this tree.`,
        })
      }
    }
  },
}

/** OKF §5.1: a footnote label is the join key into `sources[].id`. */
export const footnoteSource: Rule = {
  id: "okf/footnote-source",
  severity: "warning",
  description:
    "In a concept that has `sources` with `id`s, every footnote label matches one of them (OKF §5.1 per-claim attribution).",
  check({ tree, report }) {
    for (const concept of tree.concepts) {
      const ids = new Set(concept.sources.flatMap((s) => (s.id ? [s.id] : [])))
      if (ids.size === 0) continue
      for (const footnote of concept.footnotes) {
        if (ids.has(footnote.label)) continue
        report({
          file: concept.path,
          line: footnote.line,
          column: footnote.column,
          message: `Footnote [^${footnote.label}] matches no \`sources\` id (${[...ids].map((id) => `\`${id}\``).join(", ")}).`,
        })
      }
    }
  },
}
