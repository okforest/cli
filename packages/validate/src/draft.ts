import { Validator } from "@cfworker/json-schema"
import { type Concept, isRecord, OKF_FIELDS } from "@okforest/okf"

/** Formats a field's values are drafted with when every value has it, as
 * `okforest/type-schema` checks them. */
const FORMATS = ["date", "date-time", "email", "uri"] as const

/** Allowed values are drafted for a few short values that repeat: at most
 * this many of them... */
const ENUM_MAX = 8
/** ...none longer than this. */
const ENUM_LENGTH = 40

/**
 * A starting JSON Schema for one type's frontmatter, from what its concepts
 * hold: each field they use beyond OKF's, typed by its values; a format,
 * when every value has it; allowed values, when a few short ones repeat; and
 * the fields every concept has as `required`, when there are two or more.
 * Each field's draft is kept only if every value matches it, so every
 * concept it's drafted from matches the schema. Deterministic: no model
 * calls.
 */
export function draftTypeSchema(
  type: string,
  concepts: readonly Pick<Concept, "frontmatter">[],
): Record<string, unknown> {
  const values = new Map<string, unknown[]>()
  for (const concept of concepts) {
    for (const [key, value] of Object.entries(concept.frontmatter ?? {})) {
      if (OKF_FIELDS.includes(key) || value === null) continue
      values.set(key, [...(values.get(key) ?? []), value])
    }
  }
  const keys = [...values.keys()].sort()
  const properties = Object.fromEntries(
    keys.map((key) => [key, fieldSchema(values.get(key) as unknown[])]),
  )
  const required =
    concepts.length >= 2
      ? keys.filter((key) => (values.get(key) as unknown[]).length === concepts.length)
      : []
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: type,
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

/** One field's schema: the narrowest of its candidates every value matches. */
function fieldSchema(values: readonly unknown[]): Record<string, unknown> {
  const types = [...new Set(values.map(jsonType))].sort()
  if (types.length > 1) {
    // Integers among numbers are numbers; anything else mixed is listed.
    return types.join() === "integer,number" ? { type: "number" } : { type: types }
  }
  const type = types[0] as string
  if (type === "array") {
    const items = { type: "array", items: { type: "string" } }
    return fits(items, values) ? items : { type }
  }
  if (type !== "string") return { type }
  const strings = values as string[]
  for (const format of FORMATS) {
    const candidate = { type, format }
    if (fits(candidate, strings)) return candidate
  }
  const distinct = [...new Set(strings)].sort()
  const repeats = distinct.every((value) => strings.filter((s) => s === value).length >= 2)
  return repeats && distinct.length <= ENUM_MAX && distinct.every((v) => v.length <= ENUM_LENGTH)
    ? { type, enum: distinct }
    : { type }
}

/** Whether every value matches a field's schema, as the rule checks it. */
function fits(schema: Record<string, unknown>, values: readonly unknown[]): boolean {
  const validator = new Validator(schema, "2020-12", true)
  return values.every((value) => validator.validate(value).valid)
}

function jsonType(value: unknown): string {
  if (Array.isArray(value)) return "array"
  if (isRecord(value)) return "object"
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number"
  return typeof value
}
