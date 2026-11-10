import { isMap, isScalar, type Pair, parseDocument, stringify } from "yaml"
import { normalizeText } from "./document.js"
import type { TypeTemplate } from "./types.js"

/** What a new page is given by whoever creates it. */
export interface PageStart {
  type: string
  title?: string
  description?: string
}

const DELIMITER = /^---[ \t]*$/

/**
 * A new concept's text: its type's template as written, with `title` and
 * `description` set to those given (in place, where the template has them;
 * otherwise after `type`), every other byte of the template kept: its key
 * order, comments, and body. Without a usable template (none, or front matter
 * that isn't a mapping), just `type`, `title`, and `description`.
 */
export function startPage(
  start: PageStart,
  template?: Pick<TypeTemplate, "text" | "frontmatter">,
): string {
  if (!template?.frontmatter) {
    const { type, title, description } = start
    return `---\n${stringify({ type, ...(title && { title }), ...(description && { description }) }, { lineWidth: 0 })}---\n\n`
  }
  // Front matter was read, so the text opens and closes a `---` block.
  const lines = normalizeText(template.text).split("\n")
  const close = lines.findIndex((line, i) => i > 0 && DELIMITER.test(line))
  let yaml = lines.slice(1, close).join("\n")
  if (yaml !== "") yaml += "\n"
  if (start.title !== undefined) yaml = setField(yaml, "title", start.title, ["type"])
  if (start.description !== undefined) {
    yaml = setField(yaml, "description", start.description, ["title", "type"])
  }
  return [lines[0], `${yaml}${lines.slice(close).join("\n")}`].join("\n")
}

/** `yaml` with top-level `key` set to `value`: its text replaced where it's
 * written (a comment after it kept), or a line added after the first of
 * `after` it has, else first. */
function setField(yaml: string, key: string, value: string, after: readonly string[]): string {
  const line = `${key}: ${stringify(value, { lineWidth: 0 }).trimEnd()}`
  const pairs = topLevelPairs(yaml)
  const existing = pairs.get(key)
  if (existing) {
    // An empty value (`title:`) ends where its key does, and a block scalar
    // (`>`) after its newline.
    const [start, keyEnd] = range(existing.key)
    let end = Math.max(range(existing.value)[1], keyEnd)
    while (end > keyEnd && yaml[end - 1] === "\n") end--
    return `${yaml.slice(0, start)}${line}${yaml.slice(end)}`
  }
  const anchor = after.map((name) => pairs.get(name)).find(Boolean)
  if (!anchor) return `${line}\n${yaml}`
  // After the anchor's line: `yaml` ends with a newline, and a value's end
  // is at most just past the one ending it (a block scalar's).
  const end = range(anchor.value)[2]
  const at = yaml.indexOf("\n", end - 1) + 1
  return `${yaml.slice(0, at)}${line}\n${yaml.slice(at)}`
}

/** A mapping's top-level pairs by key, as written. */
function topLevelPairs(yaml: string): Map<string, Pair> {
  const document = parseDocument(yaml, { version: "1.2", schema: "core" })
  const pairs = new Map<string, Pair>()
  if (!isMap(document.contents)) return pairs
  for (const pair of document.contents.items) {
    if (isScalar(pair.key)) pairs.set(String(pair.key.value), pair)
  }
  return pairs
}

/** A parsed node's `[start, valueEnd, nodeEnd]` offsets: every key and value
 * read from text has them, an empty value (`title:`) too. */
function range(node: unknown): [number, number, number] {
  return (node as { range: [number, number, number] }).range
}
