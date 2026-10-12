import { type ReservedFile, visit } from "@okforest/okf"
import type { Heading, List, ListItem } from "mdast"
import type { Rule } from "../types.js"
import { at, isIsoDate, show } from "../util.js"

/** OKF §11.1: every non-reserved `.md` file has a parseable YAML frontmatter
 * block. Unreadable blocks in `index.md` and `log.md` are reported here too. */
export const frontmatter: Rule = {
  id: "okf/frontmatter",
  severity: "error",
  description: "Every concept starts with a parseable YAML frontmatter block (OKF §4, §11).",
  check({ tree, report }) {
    for (const file of [...tree.concepts, ...tree.reserved]) {
      if (file.frontmatterError) {
        report({ file: file.path, ...file.frontmatterError })
      } else if (file.kind === "concept" && !file.hasFrontmatter) {
        report({
          file: file.path,
          line: 1,
          column: 1,
          message:
            "No frontmatter: a concept must start with a `---` YAML block declaring at least `type`. " +
            "If this is not a concept, add it to `ignore:` in .okforest/tree.yaml.",
        })
      }
    }
  },
}

/** OKF §11.2: every frontmatter block has a non-empty `type`. */
export const type: Rule = {
  id: "okf/type",
  severity: "error",
  description: "Every concept's frontmatter has a non-empty string `type` (OKF §4.1, §11).",
  check({ tree, report }) {
    for (const concept of tree.concepts) {
      if (!concept.frontmatter) continue
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
    }
  },
}

/** OKF §8, §12: `index.md` has no frontmatter, except `okf_version` at the root. */
export const indexFrontmatter: Rule = {
  id: "okf/index-frontmatter",
  severity: "error",
  description:
    "index.md files carry no frontmatter, except an `okf_version` key in the bundle-root index.md (OKF §8, §12).",
  check({ tree, report }) {
    for (const index of tree.reserved.filter((r) => r.kind === "index" && r.frontmatter)) {
      const keys = Object.keys(index.frontmatter ?? {})
      if (index.directory !== "") {
        report({
          file: index.path,
          line: 1,
          column: 1,
          message: "Only the bundle-root index.md may have frontmatter; remove this block.",
        })
        continue
      }
      for (const key of keys.filter((k) => k !== "okf_version")) {
        report({
          file: index.path,
          ...at(index, [key]),
          message: `The root index.md frontmatter may only declare \`okf_version\`; remove \`${key}\`.`,
        })
      }
    }
  },
}

/** OKF §8: index entries are list items that start with a link. */
export const indexEntries: Rule = {
  id: "okf/index-entries",
  severity: "warning",
  description:
    "index.md lists its directory as `* [Title](path) - description` entries under headings (OKF §8).",
  check({ tree, report }) {
    for (const index of tree.reserved.filter((r) => r.kind === "index")) {
      const items = topLevelItems(index)
      if (items.length === 0) {
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
    }
  },
}

function topLevelItems(index: ReservedFile): ListItem[] {
  return index.ast.children
    .filter((node): node is List => node.type === "list")
    .flatMap((list) => list.children)
}

const dateHeadings = (log: ReservedFile) =>
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
  check({ tree, report }) {
    for (const log of tree.reserved.filter((r) => r.kind === "log")) {
      for (const heading of dateHeadings(log).filter((h) => !isIsoDate(h.text))) {
        report({
          file: log.path,
          line: heading.line,
          column: heading.column,
          message: `Log date headings must be ISO 8601 dates such as \`## 2026-05-22\` (got ${show(heading.text)}).`,
        })
      }
    }
  },
}

/** OKF §9: newest first. */
export const logOrder: Rule = {
  id: "okf/log-order",
  severity: "warning",
  description: "log.md lists its dates newest first, each once (OKF §9).",
  check({ tree, report }) {
    for (const log of tree.reserved.filter((r) => r.kind === "log")) {
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
    }
  },
}

/** OKF §12: declare the targeted version in the bundle-root index.md. */
export const okfVersion: Rule = {
  id: "okf/okf-version",
  severity: "info",
  description: 'The bundle-root index.md declares `okf_version: "0.2"` (OKF §12).',
  check({ tree, report }) {
    const root = tree.reserved.find((r) => r.path === "index.md")
    if (!root) {
      report({
        file: "index.md",
        message:
          'No root index.md: add one declaring `okf_version: "0.2"` and listing the top-level directories.',
      })
    } else if (tree.okfVersion === undefined) {
      report({
        file: root.path,
        line: 1,
        column: 1,
        message: 'Declare the OKF version this bundle targets: frontmatter `okf_version: "0.2"`.',
      })
    } else if (typeof tree.okfVersion !== "string") {
      report({
        file: root.path,
        ...at(root, ["okf_version"]),
        message: `Quote \`okf_version\` so it reads as a string: \`okf_version: "${tree.okfVersion}"\`.`,
      })
    } else if (tree.okfVersion !== "0.2") {
      report({
        file: root.path,
        ...at(root, ["okf_version"]),
        message: `This validator implements OKF 0.2; \`okf_version: "${tree.okfVersion}"\` is checked best-effort.`,
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
