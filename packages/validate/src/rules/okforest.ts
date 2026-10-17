import { editDistance, type KeyPath, SETTINGS_PATH, visit } from "@okforest/okf"
import type { Report, Rule } from "../types.js"
import { describeType, show, slugify } from "../util.js"

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Lowercase-hyphen slugs: punctuated slugs produce broken URL variants when
 * bundles are published on the web. */
export const slug: Rule = {
  id: "okforest/slug",
  severity: "warning",
  description:
    "File and directory names of concepts are slugs: lowercase letters, digits, and hyphens.",
  check({ tree, report }) {
    const directories = new Set<string>()
    for (const file of [...tree.concepts, ...tree.reserved]) {
      const segments = file.path.split("/")
      for (let i = 1; i < segments.length; i++) directories.add(segments.slice(0, i).join("/"))
      if (file.kind !== "concept") continue
      const stem = (segments.at(-1) as string).slice(0, -".md".length)
      if (!SLUG.test(stem)) {
        report({ file: file.path, message: notSlug(stem, "File name") })
      }
    }
    for (const directory of [...directories].sort()) {
      const name = directory.slice(directory.lastIndexOf("/") + 1)
      if (!SLUG.test(name))
        report({ file: `${directory}/`, message: notSlug(name, "Directory name") })
    }
  },
}

function notSlug(name: string, what: string): string {
  const suggestion = slugify(name)
  return (
    `${what} ${show(name)} is not a slug: use lowercase letters, digits, and hyphens` +
    (suggestion && suggestion !== name ? ` (e.g. ${show(suggestion)}).` : ".")
  )
}

const TEXT_PLACEHOLDERS: { pattern: RegExp; what: string }[] = [
  { pattern: /\{\{[^{}\n]*\}\}/g, what: "template placeholder" },
  { pattern: /\{%[^%\n]*%\}/g, what: "template tag" },
  { pattern: /\$\{[^}\n]*\}/g, what: "template placeholder" },
  { pattern: /\[(?:INSERT|TODO|TBD|PLACEHOLDER|YOUR)\b[^\]\n]*\]/g, what: "placeholder" },
]

// HTML elements a concept may legitimately use inline; any other `<word>`
// tag is almost certainly an unrendered placeholder such as `<concept>`.
const HTML_ELEMENTS = new Set(
  (
    "a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption " +
    "cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset " +
    "figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins " +
    "kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option " +
    "output p picture pre progress q rp rt ruby s samp script search section select slot small source " +
    "span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr " +
    "track u ul var video wbr svg math center font tt strike big"
  ).split(" "),
)
const TAG = /^<([a-zA-Z][\w-]*)(?:\s+[^<>="']+)?\s*\/?>$/

/** Unrendered template placeholders and example paths in concept bodies,
 * which web crawlers follow as real links. Code is never checked. */
export const placeholder: Rule = {
  id: "okforest/placeholder",
  severity: "warning",
  description:
    "Bodies contain no unrendered template placeholders (`{{name}}`, `<concept>`, `[INSERT ...]`) or example link paths (`path/to/...`).",
  check({ tree, report }) {
    for (const file of [...tree.concepts, ...tree.reserved]) {
      visit(file.ast, (node) => {
        const start = node.position?.start
        if (!start) return
        if (node.type === "text") {
          for (const { pattern, what } of TEXT_PLACEHOLDERS) {
            for (const match of node.value.matchAll(pattern)) {
              report({
                file: file.path,
                ...offsetIn(node.value, match.index, start),
                message: `Unrendered ${what} ${show(match[0])}.`,
              })
            }
          }
        } else if (node.type === "html") {
          const tag = TAG.exec(node.value.trim())
          if (tag && !HTML_ELEMENTS.has((tag[1] as string).toLowerCase())) {
            report({
              file: file.path,
              line: start.line,
              column: start.column,
              message: `Unrendered placeholder ${show(node.value.trim())}.`,
            })
          }
        } else if (node.type === "link" || node.type === "image") {
          if (/\{\{|\}\}|%7b%7b|[<>]|(?:^|\/)path\/to\//i.test(node.url)) {
            report({
              file: file.path,
              line: start.line,
              column: start.column,
              message: `Link to a placeholder or example path ${show(node.url)}.`,
            })
          }
        }
      })
    }
  },
}

/** Obsidian-style `[[wikilinks]]` render as literal text in OKF consumers. */
export const wikilink: Rule = {
  id: "okforest/wikilink",
  severity: "warning",
  description: "Concepts link with standard markdown links, not `[[wikilinks]]` (OKF §6.1).",
  check({ tree, report }) {
    for (const file of [...tree.concepts, ...tree.reserved]) {
      visit(file.ast, (node) => {
        if (node.type !== "text" || !node.position) return
        for (const match of node.value.matchAll(/\[\[([^[\]\n]+)\]\]/g)) {
          report({
            file: file.path,
            ...offsetIn(node.value, match.index, node.position.start),
            message: `${show(match[0])} is a wikilink, not an OKF link: write \`[${match[1]}](${slugify(match[1] as string) || "concept"}.md)\` with the concept's path.`,
          })
        }
      })
    }
  },
}

/** Line and column of `index` within a text node starting at `start`. */
function offsetIn(value: string, index: number, start: { line: number; column: number }) {
  const before = value.slice(0, index)
  const newlines = before.split("\n").length - 1
  return newlines === 0
    ? { line: start.line, column: start.column + index }
    : { line: start.line + newlines, column: index - before.lastIndexOf("\n") }
}

/** Only the `.yaml` spelling is read; a `.yml` file would be ignored without
 * a word. */
const MISSPELLED_SETTINGS_PATH = ".okforest/settings.yml"

const LIMITS = { name: 100, description: 4000 } as const

/** `.okforest/settings.yaml` (an OKForest convention): well-formed optional
 * settings, under the one name OKForest reads. */
export const settingsFile: Rule = {
  id: "okforest/settings",
  severity: "error",
  description:
    "`.okforest/settings.yaml` (spelled `.yaml`) holds well-formed settings: a `name` of up to 100 characters, a `description` of up to 4,000, and `ignore` globs.",
  check({ tree, report }) {
    if (tree.files.includes(MISSPELLED_SETTINGS_PATH)) {
      report({
        file: MISSPELLED_SETTINGS_PATH,
        line: 1,
        column: 1,
        message: `Rename \`${MISSPELLED_SETTINGS_PATH}\` to \`${SETTINGS_PATH}\`: only the \`.yaml\` name is read, so these settings are ignored.`,
      })
    }
    const settings = tree.settings
    if (!settings) return
    const problem = (path: KeyPath, message: string) =>
      report({
        file: settings.path,
        ...(settings.locate(path) ?? { line: 1, column: 1 }),
        message,
      } satisfies Report)
    if (settings.error) {
      report({ file: settings.path, ...settings.error })
      return
    }
    const data = settings.data ?? {}
    for (const [key, limit] of Object.entries(LIMITS)) {
      const value = data[key]
      if (value === undefined) continue
      if (typeof value !== "string") {
        problem([key], `\`${key}\` must be text (got ${describeType(value)}).`)
      } else if (value.trim() === "") {
        problem([key], `\`${key}\` is blank: write it, or remove the setting.`)
      } else if ([...value].length > limit) {
        problem(
          [key],
          `\`${key}\` is ${[...value].length.toLocaleString("en-US")} characters; the limit is ${limit.toLocaleString("en-US")}.`,
        )
      }
    }
    if (data.ignore !== undefined) {
      if (!Array.isArray(data.ignore)) {
        problem(["ignore"], "`ignore` must be a list of globs relative to the bundle root.")
      } else {
        data.ignore.forEach((glob, i) => {
          if (typeof glob !== "string" || glob.trim() === "")
            problem(["ignore", i], "Each `ignore` entry must be a glob string.")
        })
      }
    }
  },
}

/** The settings `.okforest/settings.yaml` may hold (docs: /docs/settings/;
 * kept in step with `schemas/settings.schema.json` by a test). */
export const SETTINGS_KEYS: readonly string[] = ["name", "description", "ignore"]

/** Settings OKForest doesn't know are ignored, so a misspelled key loses its
 * setting without a word; this says so. A warning: a newer OKForest may know
 * keys an older one doesn't. */
export const settingsKeys: Rule = {
  id: "okforest/settings-keys",
  severity: "warning",
  description:
    "`.okforest/settings.yaml` uses only the settings OKForest knows; others, such as a misspelled key, are ignored.",
  check({ tree, report }) {
    const settings = tree.settings
    if (!settings?.data) return
    for (const key of Object.keys(settings.data)) {
      if (SETTINGS_KEYS.includes(key)) continue
      const near = SETTINGS_KEYS.find((known) => editDistance(key, known, 2) <= 2)
      report({
        file: settings.path,
        ...(settings.locate([key]) ?? { line: 1, column: 1 }),
        message: near
          ? `Unknown setting \`${key}\`: did you mean \`${near}\`? Unknown settings are ignored.`
          : `Unknown setting \`${key}\`, ignored. The settings are ${SETTINGS_KEYS.map((k) => `\`${k}\``).join(", ")}.`,
      })
    }
  },
}
