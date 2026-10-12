import type { KeyPath, MarkdownFile, Position } from "@okforest/okf"

const DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:[Zz]|[+-](\d{2}):?(\d{2}))$/

/** An ISO 8601 datetime with an explicit UTC offset (spec §5), on a real calendar date. */
export function isDatetime(value: unknown): boolean {
  if (typeof value !== "string") return false
  const m = DATETIME.exec(value)
  if (!m) return false
  const [year, month, day, hour, minute, second, offsetHours, offsetMinutes] = m
    .slice(1)
    .map((part) => (part === undefined ? 0 : Number(part))) as number[]
  const date = new Date(Date.UTC(year as number, (month as number) - 1, day))
  return (
    date.getUTCMonth() === (month as number) - 1 &&
    date.getUTCDate() === day &&
    (hour as number) < 24 &&
    (minute as number) < 60 &&
    (second as number) < 61 &&
    (offsetHours as number) < 24 &&
    (offsetMinutes as number) < 60
  )
}

/** A real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isDatetime(`${value}T00:00:00Z`)
}

/** Where a frontmatter key is, falling back to the start of the file. */
export function at(file: Pick<MarkdownFile, "locate">, path: KeyPath): Position {
  return file.locate(path) ?? { line: 1, column: 1 }
}

/** Render a value briefly for a message. */
export function show(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return `\`${text && text.length > 60 ? `${text.slice(0, 57)}...` : text}\``
}

export function describeType(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "a list"
  if (typeof value === "object") return "a mapping"
  return `a ${typeof value}`
}

/** Lowercase letters, digits, and hyphens: `Events_Table` → `events-table`. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
