import { type OutputUnit, type SchemaDraft, Validator } from "@cfworker/json-schema"
import { isRecord, type KeyPath, type TypeSchema } from "@okforest/okf"
import type { CheckContext, Rule } from "../types.js"
import { describeType, show } from "../util.js"

/** The frontmatter keys OKF defines (§4.1, §5, §10.2). A type's schema
 * describes its own fields; these are left out of what it checks unless it
 * names them in `properties`, so `additionalProperties: false` still lets a
 * concept carry its `title` or `verified`. */
const OKF_KEYS: readonly string[] = [
  "type",
  "title",
  "description",
  "resource",
  "tags",
  "sources",
  "usage_window",
  "generated",
  "verified",
  "status",
  "stale_after",
  "runtime",
  "parameters",
  "computation",
  "executor",
  "attester",
]

/** The JSON Schema drafts a schema's `$schema` can name; 2020-12 otherwise. */
const DRAFTS: readonly [RegExp, SchemaDraft][] = [
  [/draft-04/, "4"],
  [/draft-07/, "7"],
  [/2019-09/, "2019-09"],
  [/2020-12/, "2020-12"],
]

/** Formats worth naming in a message, by what they look like. */
const FORMATS: Readonly<Record<string, string>> = {
  date: "a date like `2026-06-30`",
  "date-time": "a date and time like `2026-06-30T14:00:00Z`",
  email: "an email address",
  uri: "a URI",
  "uri-reference": "a URI or a relative path",
}

/** A schema the validator can use, for the type named by its title. */
interface Usable {
  schema: TypeSchema & { name: string }
  validator: Validator
}

/** A type's schema in `.okforest/types/` says what its concepts' frontmatter
 * holds; a concept of that type must match it. */
export const typeSchema: Rule = {
  id: "okforest/type-schema",
  severity: "error",
  description:
    "Concepts match their type's JSON Schema in `.okforest/types/`, and each schema there is a usable JSON Schema for one type.",
  async checkFile(file, context) {
    if (file.kind !== "concept" || typeof file.type !== "string" || !file.frontmatter) return
    const usable = (await schemasOf(context)).get(file.type)
    if (!usable) return
    const named = isRecord(usable.schema.data) ? usable.schema.data.properties : undefined
    const own = isRecord(named) ? named : {}
    const instance = Object.fromEntries(
      Object.entries(file.frontmatter).filter(([key]) => !OKF_KEYS.includes(key) || key in own),
    )
    for (const unit of leaves(usable.validator.validate(instance).errors)) {
      const path = keyPath(unit.instanceLocation)
      // An unknown field is reported where it's written; a missing one, at
      // the mapping that lacks it (the concept's `type` for the top level).
      const at = unit.keyword === "additionalProperties" ? [...path, propertyOf(unit.error)] : path
      const where = (at.length > 0 && file.locate(at)) ||
        file.locate(["type"]) || { line: 1, column: 1 }
      context.report({
        file: file.path,
        ...where,
        message: explain(unit, path, valueAt(file.frontmatter, path), usable.schema.name),
      })
    }
  },
  async checkTree(context) {
    await schemasOf(context)
  },
}

/**
 * The tree's usable type schemas by type, made once a run. Problems with a
 * schema file are reported here, against the file, and it's left out: a
 * concept is only checked against a schema that can check it.
 */
function schemasOf(context: CheckContext): Promise<Map<string, Usable>> {
  return context.once("okforest/type-schema", async () => {
    const usable = new Map<string, Usable>()
    const firstPath = new Map<string, string>()
    for (const schema of context.outline.types) {
      const problem = (path: KeyPath, message: string) =>
        context.report({
          file: schema.path,
          ...(schema.locate(path) ?? { line: 1, column: 1 }),
          message,
        })
      if (schema.error) {
        context.report({ file: schema.path, ...schema.error })
        continue
      }
      const data = schema.data
      if (!isRecord(data)) {
        problem([], `A type schema must be a JSON object (got ${describeType(data)}).`)
        continue
      }
      if (schema.name === undefined) {
        problem(
          data.title === undefined ? [] : ["title"],
          "A type schema needs a `title`: the type it's for, as concepts write it in `type`.",
        )
        continue
      }
      if (data.type !== undefined && data.type !== "object") {
        problem(
          ["type"],
          `A type schema describes frontmatter, which is a mapping: its \`type\` must be \`object\`, not ${show(data.type)}.`,
        )
        continue
      }
      const earlier = firstPath.get(schema.name)
      if (earlier) {
        problem(
          ["title"],
          `${earlier} is already the schema for ${show(schema.name)}; a type has one schema.`,
        )
        continue
      }
      firstPath.set(schema.name, schema.path)
      const dangling = refsIn(data).find(({ ref }) => !resolves(data, ref))
      if (dangling) {
        problem(
          dangling.path,
          dangling.ref.startsWith("#")
            ? `\`$ref\` ${show(dangling.ref)} leads nowhere in this schema.`
            : `\`$ref\` ${show(dangling.ref)} can't be followed: a type schema refers only within itself (\`#/$defs/...\`).`,
        )
        continue
      }
      const declared = typeof data.$schema === "string" ? data.$schema : ""
      const draft = DRAFTS.find(([pattern]) => pattern.test(declared))?.[1] ?? "2020-12"
      const validator = new Validator(data, draft, false)
      try {
        validator.validate({})
      } catch (cause) {
        problem(
          [],
          `This schema can't be used: ${cause instanceof Error ? cause.message.split("\n")[0] : cause}`,
        )
        continue
      }
      usable.set(schema.name, { schema: { ...schema, name: schema.name }, validator })
    }
    return usable
  })
}

/** Every `$ref` in a schema, with where it's written. */
function refsIn(value: unknown, path: KeyPath = []): { ref: string; path: KeyPath }[] {
  if (Array.isArray(value)) return value.flatMap((item, i) => refsIn(item, [...path, i]))
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([key, item]) =>
    key === "$ref" && typeof item === "string"
      ? [{ ref: item, path: [...path, key] }]
      : refsIn(item, [...path, key]),
  )
}

/** Whether a `$ref` leads somewhere in the schema: a JSON Pointer (`#/...`)
 * to a value, or an `$anchor` (`#name`) the schema declares. */
function resolves(schema: Record<string, unknown>, ref: string): boolean {
  if (ref === "#") return true
  if (!ref.startsWith("#")) return false
  if (!ref.startsWith("#/")) {
    const anchor = ref.slice(1)
    const declares = (value: unknown): boolean =>
      Array.isArray(value)
        ? value.some(declares)
        : isRecord(value) && (value.$anchor === anchor || Object.values(value).some(declares))
    return declares(schema)
  }
  let value: unknown = schema
  for (const raw of ref.slice(2).split("/")) {
    const key = decodeURIComponent(raw).replaceAll("~1", "/").replaceAll("~0", "~")
    if (Array.isArray(value) && /^\d+$/.test(key)) value = value[Number(key)]
    else if (isRecord(value) && key in value) value = value[key]
    else return false
  }
  return true
}

/** Keywords the validator reports above the failures under them. */
const SUMMARIES: readonly string[] = [
  "properties",
  "patternProperties",
  "items",
  "prefixItems",
  "allOf",
  "$ref",
  "$dynamicRef",
  "dependentSchemas",
  "then",
  "else",
]

/**
 * The failures worth reporting: each one where it happened, without the
 * summaries the validator adds above them ("Property x does not match
 * schema"). A failed `anyOf` or `oneOf` is one failure, not one per choice.
 */
function leaves(units: readonly OutputUnit[]): OutputUnit[] {
  const choices = units
    .filter((u) => ["anyOf", "oneOf", "not"].includes(u.keyword))
    .map((u) => `${u.keywordLocation}/`)
  const unknown = new Set(
    units
      .filter((u) => u.keyword === "additionalProperties")
      .map((u) => `${u.instanceLocation}/${propertyOf(u.error)}`),
  )
  return units.filter(
    (u) =>
      !SUMMARIES.includes(u.keyword) &&
      !choices.some((prefix) => u.keywordLocation.startsWith(prefix)) &&
      !(u.keyword === "false" && unknown.has(u.instanceLocation)),
  )
}

/** A message a person can act on, for the common failures; the validator's
 * own words for the rest. */
function explain(unit: OutputUnit, path: KeyPath, value: unknown, type: string): string {
  const field = path.length > 0 ? `\`${label(path)}\`` : "The frontmatter"
  switch (unit.keyword) {
    case "required": {
      const missing = propertyOf(unit.error)
      return `Missing \`${label([...path, missing])}\`, which the ${type} type requires.`
    }
    case "additionalProperties":
      return `\`${label([...path, propertyOf(unit.error)])}\` isn't a field of the ${type} type.`
    case "false":
      return `${field} isn't allowed in the ${type} type.`
    case "enum": {
      const options = /any of (\[.*\])\.$/.exec(unit.error)?.[1]
      const list = options ? (JSON.parse(options) as unknown[]).map(show).join(", ") : "its values"
      return `${field} must be one of ${list} (got ${show(value)}).`
    }
    case "const":
      return `${field} doesn't have the value the ${type} type requires (got ${show(value)}).`
    case "type": {
      const expected =
        /Expected (.+)\.$/.exec(unit.error)?.[1]?.replaceAll('"', "") ?? "another type"
      return `${field} must be ${article(expected)} (got ${describeType(value)}).`
    }
    case "format": {
      const format = /format "(.+)"/.exec(unit.error)?.[1] ?? ""
      return `${field} must be ${FORMATS[format] ?? `in the \`${format}\` format`} (got ${show(value)}).`
    }
    case "anyOf":
    case "oneOf":
      return `${field} doesn't match any of the forms the ${type} type allows (got ${show(value)}).`
    default:
      return `${field}: ${unit.error}`
  }
}

/** `a string`, `an integer`, or a choice: `a string or a number`. */
function article(types: string): string {
  return types
    .split(/,\s*/)
    .map((t) =>
      t === "null"
        ? "null"
        : `${/^[aeiou]/.test(t) ? "an" : "a"} ${t === "object" ? "mapping" : t === "array" ? "list" : t}`,
    )
    .join(" or ")
}

/** The property a `required` or `additionalProperties` message names. */
function propertyOf(error: string): string {
  return /property "(.+?)"|Property "(.+?)"/.exec(error)?.slice(1).find(Boolean) ?? ""
}

/** A JSON Pointer (`#/regions/1`) as a frontmatter key path. */
function keyPath(pointer: string): KeyPath {
  return pointer
    .replace(/^#\/?/, "")
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment))
}

/** `regions[1]`, `owner.email`. */
function label(path: KeyPath): string {
  return path
    .map((segment, i) =>
      typeof segment === "number" ? `[${segment}]` : i === 0 ? segment : `.${segment}`,
    )
    .join("")
}

function valueAt(frontmatter: Record<string, unknown>, path: KeyPath): unknown {
  let value: unknown = frontmatter
  for (const segment of path) {
    if (Array.isArray(value) && typeof segment === "number") value = value[segment]
    else if (isRecord(value) && typeof segment === "string") value = value[segment]
    else return undefined
  }
  return value
}
