import {
  LATEST_OKF_VERSION,
  okfVersionAtLeast,
  parseOkfVersion,
  type ReservedMarkdown,
  visit,
} from "@okforest/okf"
import type { Heading, List, ListItem } from "mdast"
import type { Rule } from "../types.js"
import { at, isIsoDate, isOkf03, show } from "../util.js"

/** OKF §11.1: a frontmatter block parses. Under OKF 0.2, every
 * non-reserved `.md` file has one; under 0.3 a file without one isn't a
 * concept (§3.2) but an OtherMarkdown, which okf/not-a-concept reports.
 * Unreadable blocks in any file are reported here. */
export const frontmatter: Rule = {
  id: "okf/frontmatter",
  severity: "error",
  description:
    "Frontmatter blocks parse as YAML, and under OKF 0.2 every concept starts with one (OKF §4, §11).",
  checkFile(file, { report }) {
    if (file.frontmatterError) {
      report({ file: file.path, ...file.frontmatterError })
    } else if (file.kind === "concept" && !file.hasFrontmatter) {
      report({
        file: file.path,
        line: 1,
        column: 1,
        message:
          "No frontmatter: a concept must start with a `---` YAML block declaring at least `type`. " +
          "If this is not a concept, add it to `ignore:` in .okforest/settings.yaml.",
      })
    }
  },
}

/** OKF §11.2: under OKF 0.2, every frontmatter block has a non-empty
 * `type`; under 0.3 one without isn't a concept (§3.2) but an OtherMarkdown,
 * which okf/not-a-concept reports. */
export const type: Rule = {
  id: "okf/type",
  severity: "error",
  description:
    "Under OKF 0.2, every concept's frontmatter has a non-empty string `type` (OKF §4.1, §11).",
  checkFile(concept, { report }) {
    if (concept.kind !== "concept" || !concept.frontmatter) return
    const value = concept.frontmatter.type
    if (value === undefined) {
      report({
        file: concept.path,
        line: 1,
        column: 1,
        message: "Missing `type`, the one required key.",
      })
    } else if (typeof value !== "string" || value.trim() === "") {
      report({
        file: concept.path,
        ...at(concept, ["type"]),
        message: `\`type\` must be a non-empty string (got ${show(value)}).`,
      })
    }
  },
}

/** OKF 0.3 §3.2: a `.md` file is a concept when its frontmatter has a
 * non-empty `type`. One without isn't (a README, a CONTRIBUTING): consumers
 * skip it, and validators should say so. */
export const notAConcept: Rule = {
  id: "okf/not-a-concept",
  severity: "warning",
  description:
    "Under OKF 0.3, a `.md` file without frontmatter or a `type` isn't a concept: consumers skip it (OKF §3.2).",
  checkFile(file, { report }) {
    // An unreadable block is okf/frontmatter's to report.
    if (file.kind !== "other" || file.frontmatterError) return
    report({
      file: file.path,
      line: 1,
      column: 1,
      message: `Not a concept: ${file.hasFrontmatter ? "its frontmatter has no `type`" : "it has no frontmatter"}, so OKF skips it. If it's knowledge, give it a \`type\`; if it isn't, add it to \`ignore:\` in .okforest/settings.yaml.`,
    })
  },
}

/** OKF §8, §12: `index.md` has no frontmatter, except at the root: there,
 * `okf_version`, and from OKF 0.3 (§8.1) the bundle's own metadata. A root
 * index.md that declares 0.2, or no version (§12.1), keeps 0.2's rule, so a
 * tree moves to 0.3 when it declares it. */
export const indexFrontmatter: Rule = {
  id: "okf/index-frontmatter",
  severity: "error",
  description:
    "index.md files carry no frontmatter, except the bundle-root index.md: `okf_version`, and from OKF 0.3 the bundle's `title`, `description`, `license`, and extension keys (OKF §8, §12).",
  checkFile(index, { report }) {
    if (index.kind !== "index" || !index.frontmatter) return
    if (index.directory !== "") {
      report({
        file: index.path,
        line: 1,
        column: 1,
        message: "Only the bundle-root index.md may have frontmatter; remove this block.",
      })
      return
    }
    if (okfVersionAtLeast(index.frontmatter.okf_version, "0.3")) return
    for (const key of Object.keys(index.frontmatter).filter((k) => k !== "okf_version")) {
      report({
        file: index.path,
        ...at(index, [key]),
        message: `Under OKF 0.2, the root index.md frontmatter may only declare \`okf_version\`; remove \`${key}\`, or declare \`okf_version: "0.3"\`.`,
      })
    }
  },
}

/** OKF §8: index entries are list items that start with a link. An index
 * that lists nothing is reported only when its directory has something to
 * list, so a new, empty tree has no findings. */
export const indexEntries: Rule = {
  id: "okf/index-entries",
  severity: "warning",
  description:
    "index.md lists its directory as `* [Title](path) - description` entries under headings (OKF §8).",
  checkFile(index, { outline, report }) {
    if (index.kind !== "index") return
    const items = topLevelItems(index)
    const prefix = index.directory === "" ? "" : `${index.directory}/`
    const own = new Set([`${prefix}index.md`, `${prefix}log.md`])
    const contents = outline.markdown.some((path) => path.startsWith(prefix) && !own.has(path))
    if (items.length === 0 && contents) {
      report({
        file: index.path,
        line: index.bodyStartLine,
        column: 1,
        message: "This index lists nothing: add `* [Title](path) - description` entries.",
      })
    }
    for (const item of items) {
      const first = item.children[0]
      const lead = first?.type === "paragraph" ? first.children[0] : undefined
      if (lead?.type !== "link" && lead?.type !== "linkReference") {
        report({
          file: index.path,
          line: item.position?.start.line ?? 1,
          column: item.position?.start.column ?? 1,
          message: "Index entries should start with a link: `* [Title](path) - description`.",
        })
      }
    }
  },
}

/** OKF §8: an index enumerates its own directory's contents, so each entry
 * points within it (into a subdirectory is fine); one elsewhere belongs in a
 * concept, as a link. */
export const indexScope: Rule = {
  id: "okf/index-scope",
  severity: "warning",
  description:
    "index.md lists its own directory's contents (OKF §8): each entry points within the directory.",
  checkFile(index, { report }) {
    if (index.kind !== "index") return
    const inside = (path: string) =>
      index.directory === "" || path === index.directory || path.startsWith(`${index.directory}/`)
    // Each entry's leading link, by where it starts.
    const leads = new Set(
      topLevelItems(index).flatMap((item) => {
        const first = item.children[0]
        const lead = first?.type === "paragraph" ? first.children[0] : undefined
        const start = lead?.position?.start
        return start ? [`${start.line}:${start.column}`] : []
      }),
    )
    for (const link of index.links) {
      if (link.kind !== "internal" || !leads.has(`${link.line}:${link.column}`)) continue
      if (!link.outside && link.resolved !== undefined && inside(link.resolved)) continue
      report({
        file: index.path,
        line: link.line,
        column: link.column,
        message: `Index entries list this directory's contents (OKF §8): \`${link.target}\` is outside it. Link to it from a concept instead.`,
      })
    }
  },
}

function topLevelItems(index: ReservedMarkdown): ListItem[] {
  return index.ast.children
    .filter((node): node is List => node.type === "list")
    .flatMap((list) => list.children)
}

const dateHeadings = (log: ReservedMarkdown) =>
  log.ast.children
    .filter((node): node is Heading => node.type === "heading" && node.depth === 2)
    .map((heading) => ({
      text: headingText(heading).trim(),
      line: heading.position?.start.line ?? 1,
      column: heading.position?.start.column ?? 1,
    }))

/** OKF §9: log.md groups entries under `## YYYY-MM-DD` headings. */
export const logDate: Rule = {
  id: "okf/log-date",
  severity: "error",
  description:
    "log.md groups entries under second-level headings in ISO 8601 `YYYY-MM-DD` form (OKF §9).",
  checkFile(log, { report }) {
    if (log.kind !== "log") return
    for (const heading of dateHeadings(log).filter((h) => !isIsoDate(h.text))) {
      report({
        file: log.path,
        line: heading.line,
        column: heading.column,
        message: `Log date headings must be ISO 8601 dates such as \`## 2026-05-22\` (got ${show(heading.text)}).`,
      })
    }
  },
}

/** OKF §9: newest first. */
export const logOrder: Rule = {
  id: "okf/log-order",
  severity: "warning",
  description: "log.md lists its dates newest first, each once (OKF §9).",
  checkFile(log, { report }) {
    if (log.kind !== "log") return
    const dates = dateHeadings(log).filter((h) => isIsoDate(h.text))
    for (let i = 1; i < dates.length; i++) {
      const previous = dates[i - 1]?.text as string
      const current = dates[i] as (typeof dates)[number]
      if (current.text >= previous) {
        report({
          file: log.path,
          line: current.line,
          column: current.column,
          message:
            current.text === previous
              ? `${current.text} appears more than once; group its entries under one heading.`
              : `${current.text} comes after ${previous}; list dates newest first.`,
        })
      }
    }
  },
}

/** OKF 0.3 §9: `log.md` has no frontmatter. */
export const logFrontmatter: Rule = {
  id: "okf/log-frontmatter",
  severity: "error",
  description: "Under OKF 0.3, log.md files carry no frontmatter (OKF §9).",
  checkFile(log, context) {
    if (log.kind !== "log" || !log.hasFrontmatter || !isOkf03(context)) return
    context.report({
      file: log.path,
      line: 1,
      column: 1,
      message: "log.md has no frontmatter under OKF 0.3: remove this block.",
    })
  },
}

/** OKF §8.1, §12: the bundle-root index.md declares its OKF version, as a
 * quoted string. Whether that version is current is okforest/okf-version-current's. */
export const okfVersion: Rule = {
  id: "okf/okf-version",
  severity: "info",
  description: `The bundle-root index.md declares its OKF version, as a quoted string: \`okf_version: "${LATEST_OKF_VERSION}"\` (OKF §12).`,
  checkTree({ outline, report }) {
    if (!outline.markdown.includes("index.md")) {
      report({
        file: "index.md",
        message: `No root index.md: add one declaring \`okf_version: "${LATEST_OKF_VERSION}"\` and listing the top-level directories.`,
      })
    }
  },
  checkFile(root, { report }) {
    if (root.path !== "index.md") return
    const version =
      root.frontmatter && "okf_version" in root.frontmatter
        ? root.frontmatter.okf_version
        : undefined
    if (version === undefined) {
      report({
        file: root.path,
        line: 1,
        column: 1,
        message: `Declare the OKF version this bundle targets: frontmatter \`okf_version: "${LATEST_OKF_VERSION}"\`. Until it does, it's read as OKF 0.2.`,
      })
    } else if (parseOkfVersion(version) === undefined) {
      report({
        file: root.path,
        ...at(root, ["okf_version"]),
        message: `\`okf_version\` is \`<major>.<minor>\`, such as \`"${LATEST_OKF_VERSION}"\` (got ${show(version)}); until it is, the bundle is read as OKF 0.2.`,
      })
    } else if (typeof version !== "string") {
      report({
        file: root.path,
        ...at(root, ["okf_version"]),
        message: `Quote \`okf_version\` so it reads as a string: \`okf_version: "${version}"\`.`,
      })
    }
  },
}

export function headingText(node: Heading): string {
  let text = ""
  visit(node, (child) => {
    if (child.type === "text" || child.type === "inlineCode") text += child.value
  })
  return text
}
