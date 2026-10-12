import { parseArgs } from "node:util"
import { UsageError } from "./io.js"

/** Parse a command's arguments: options plus at most one positional path. */
export function parseCommand<T extends NonNullable<Parameters<typeof parseArgs>[0]>["options"]>(
  args: readonly string[],
  options: T,
) {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { ...options, help: { type: "boolean", short: "h" } },
    allowPositionals: true,
    strict: true,
  })
  if (positionals.length > 1) {
    throw new UsageError(`Expected one path, got ${positionals.length}: ${positionals.join(" ")}`)
  }
  return { values, path: positionals[0] ?? "." }
}

export function formatOption(value: unknown): "text" | "json" {
  if (value === undefined || value === "text") return "text"
  if (value === "json") return "json"
  throw new UsageError(`--format must be \`text\` or \`json\` (got \`${String(value)}\`).`)
}
