import { parseMarkdown, type RawLink } from "./markdown.js"
import type { MarkdownFile } from "./types.js"
import { isRecord, parseYaml } from "./yaml.js"

const DELIMITER = /^---[ \t]*$/

/** Strip a byte-order mark and normalize line endings to LF. */
export function normalizeText(text: string): string {
  return text.replace(/^﻿/, "").replace(/\r\n?/g, "\n")
}

/** A markdown file with its links still unresolved (the tree resolves them). */
export type ParsedFile = Omit<MarkdownFile, "links"> & { rawLinks: RawLink[] }

/**
 * Read one markdown file: split the frontmatter block (spec §4: `---` on its
 * own line at the start and a closing `---` on its own line), parse it as
 * YAML, and parse the body. Never throws: problems become `frontmatterError`.
 */
export function readMarkdownFile(path: string, rawText: string): ParsedFile {
  const text = normalizeText(rawText)
  const lines = text.split("\n")

  let hasFrontmatter = false
  let frontmatter: Record<string, unknown> | undefined
  let frontmatterError: MarkdownFile["frontmatterError"]
  let bodyStartLine = 1
  let locate: MarkdownFile["locate"] = () => undefined

  if (DELIMITER.test(lines[0] ?? "")) {
    hasFrontmatter = true
    const close = lines.findIndex((line, i) => i > 0 && DELIMITER.test(line))
    if (close === -1) {
      frontmatterError = {
        message: "Frontmatter block is not closed: add a `---` line after the last key.",
        line: 1,
        column: 1,
      }
      bodyStartLine = lines.length + 1
    } else {
      bodyStartLine = close + 2
      const parsed = parseYaml(lines.slice(1, close).join("\n"), 2)
      locate = parsed.locate
      if (parsed.error) {
        frontmatterError = { ...parsed.error, message: `Invalid YAML: ${parsed.error.message}` }
      } else if (parsed.value === null || parsed.value === undefined) {
        frontmatter = {}
      } else if (isRecord(parsed.value)) {
        frontmatter = parsed.value
      } else {
        frontmatterError = {
          message: "Frontmatter must be a YAML mapping of keys to values.",
          line: 2,
          column: 1,
        }
      }
    }
  }

  // Blank out the frontmatter so markdown positions are file-absolute.
  const body = lines.map((line, i) => (i < bodyStartLine - 1 ? "" : line)).join("\n")
  const { ast, links, footnotes, codeBlocks } = parseMarkdown(body)

  return {
    path,
    text,
    frontmatter,
    hasFrontmatter,
    ...(frontmatterError ? { frontmatterError } : {}),
    bodyStartLine,
    ast,
    rawLinks: links,
    footnotes,
    codeBlocks,
    locate,
  }
}
