import type { Definition, Nodes, Root } from "mdast"
import { fromMarkdown } from "mdast-util-from-markdown"
import { gfmFootnoteFromMarkdown } from "mdast-util-gfm-footnote"
import { gfmFootnote } from "micromark-extension-gfm-footnote"
import type { CodeBlock, FootnoteReference } from "./types.js"

/** A link destination as written, before it is resolved against the tree. */
export interface RawLink {
  target: string
  line: number
  column: number
  image: boolean
}

export interface ParsedMarkdown {
  ast: Root
  links: RawLink[]
  footnotes: FootnoteReference[]
  codeBlocks: CodeBlock[]
}

/**
 * Parse markdown as CommonMark plus GFM footnotes, the one GitHub extension
 * OKF relies on (per-claim attribution, spec §5.1). Other GFM extensions
 * (tables, strikethrough, task lists, bare-URL autolinks) change nothing the
 * model or rules use, and skipping them parses about 1.5x faster: links in
 * table cells are still found, since a table row parses as a paragraph.
 * Positions are relative to `source`; callers blank out frontmatter lines so
 * they stay relative to the whole file.
 */
export function parseMarkdown(source: string): ParsedMarkdown {
  const ast = fromMarkdown(source, {
    extensions: [gfmFootnote()],
    mdastExtensions: [gfmFootnoteFromMarkdown()],
  })
  const lines = source.split("\n")
  const definitions = new Map<string, Definition>()
  visit(ast, (node) => {
    if (node.type === "definition") definitions.set(node.identifier, node)
  })

  const links: RawLink[] = []
  const footnotes: FootnoteReference[] = []
  const codeBlocks: CodeBlock[] = []
  visit(ast, (node) => {
    const start = node.position?.start
    if (!start) return
    switch (node.type) {
      case "link":
      case "image":
        links.push({
          target: node.url,
          line: start.line,
          column: start.column,
          image: node.type === "image",
        })
        break
      case "linkReference":
      case "imageReference": {
        const definition = definitions.get(node.identifier)
        if (definition) {
          links.push({
            target: definition.url,
            line: start.line,
            column: start.column,
            image: node.type === "imageReference",
          })
        }
        break
      }
      case "footnoteReference":
        footnotes.push({
          label: node.label ?? node.identifier,
          line: start.line,
          column: start.column,
        })
        break
      case "code": {
        const fenced = /^\s*(`{3,}|~{3,})/.test(lines[start.line - 1] ?? "")
        codeBlocks.push({
          ...(node.lang ? { lang: node.lang } : {}),
          value: node.value,
          line: start.line,
          contentLine: fenced ? start.line + 1 : start.line,
        })
        break
      }
    }
  })
  return { ast, links, footnotes, codeBlocks }
}

/** Depth-first, document-order walk over an mdast tree. */
export function visit(node: Nodes, fn: (node: Nodes) => void): void {
  fn(node)
  if ("children" in node) {
    for (const child of node.children) visit(child, fn)
  }
}
