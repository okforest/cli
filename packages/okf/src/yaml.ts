import { isMap, isScalar, isSeq, LineCounter, parseDocument } from "yaml"
import type { Diagnostic, KeyPath, Position } from "./types.js"

export interface ParsedYaml {
  /** The value as plain JavaScript; `undefined` when there were errors. */
  value: unknown
  error?: Diagnostic
  locate(path: KeyPath): Position | undefined
}

/**
 * Parse YAML 1.2 (core schema), so unquoted timestamps such as
 * `2026-06-30T14:00:00Z` stay strings and can be checked as written, and
 * `yes`/`no` are not booleans. Duplicate keys are errors: consumers disagree
 * on which value wins, so the data is ambiguous.
 *
 * `firstLine` is the file line where `source` begins, so positions are
 * reported relative to the whole file.
 */
export function parseYaml(source: string, firstLine: number): ParsedYaml {
  const lineCounter = new LineCounter()
  const doc = parseDocument(source, {
    lineCounter,
    prettyErrors: false,
    uniqueKeys: true,
    version: "1.2",
    schema: "core",
  })
  const at = (offset: number): Position => {
    const { line, col } = lineCounter.linePos(offset)
    return { line: line + firstLine - 1, column: col }
  }

  const locate = (path: KeyPath): Position | undefined => {
    let node: unknown = doc.contents
    let offset: number | undefined
    for (const segment of path) {
      if (typeof segment === "number" && isSeq(node)) {
        node = node.items[segment]
        offset = (node as { range?: [number, number, number] } | undefined)?.range?.[0]
      } else if (isMap(node)) {
        const pair = node.items.find((p) => isScalar(p.key) && p.key.value === segment)
        if (!pair) return undefined
        offset = (pair.key as { range?: [number, number, number] }).range?.[0]
        node = pair.value
      } else {
        return undefined
      }
      if (node === undefined && offset === undefined) return undefined
    }
    return offset === undefined ? undefined : at(offset)
  }

  const first = doc.errors[0]
  if (first) {
    const { line, column } = at(first.pos[0])
    return { value: undefined, error: { message: first.message, line, column }, locate }
  }
  return { value: doc.toJS({ maxAliasCount: 100 }), locate }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
