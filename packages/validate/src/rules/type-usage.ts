import { findNearDuplicates, type KeyPath, TYPES_FOLDER, typeSlug } from "@okforest/okf"
import type { CheckContext, Rule } from "../types.js"
import { at } from "../util.js"

/** Where a type is first written, by path, and how many concepts give it. */
interface TypeUse {
  file: string
  line: number
  column: number
  count: number
}

/** This run's concept types, gathered a file at a time for one rule and read
 * once every file is checked. */
const typesOf = (context: CheckContext, rule: string) =>
  context.once<Map<string, TypeUse>>(`${rule}/types`, async () => new Map())

/** Records a concept's type, for a rule that reads them all at the end. */
async function recordType(
  rule: string,
  file: Parameters<NonNullable<Rule["checkFile"]>>[0],
  context: CheckContext,
) {
  if (file.kind !== "concept" || !file.type) return
  const types = await typesOf(context, rule)
  const use = types.get(file.type)
  // The first by path, however the tree is read (a file at a time, in any
  // order, or whole), so the finding is the same either way.
  const here = { file: file.path, ...at(file, ["type"]) }
  if (!use) types.set(file.type, { ...here, count: 1 })
  else types.set(file.type, { ...(here.file < use.file ? here : use), count: use.count + 1 })
}

const concepts = (count: number) => `${count} ${count === 1 ? "concept" : "concepts"}`

/** A type's files in `.okforest/types/`, each with the type it names. */
function typeFiles(context: CheckContext) {
  const { types, templates } = context.outline
  return [
    ...types.flatMap((schema) =>
      schema.name === undefined
        ? []
        : [
            {
              kind: "schema" as const,
              path: schema.path,
              name: schema.name,
              key: ["title"] as KeyPath,
              locate: schema.locate,
            },
          ],
    ),
    ...templates.flatMap((template) =>
      template.name === undefined
        ? []
        : [
            {
              kind: "template" as const,
              path: template.path,
              name: template.name,
              key: ["type"] as KeyPath,
              locate: template.locate,
            },
          ],
    ),
  ]
}

/** A schema or template for a type no concept gives: often left behind when
 * a tree is split or a type renamed. A type defined before its pages are
 * written is fine, so it's only noted. */
export const unusedType: Rule = {
  id: "okforest/unused-type",
  severity: "info",
  description:
    "Each type schema and template in `.okforest/types/` is for a type some concept in the tree gives.",
  async checkFile(file, context) {
    await recordType("okforest/unused-type", file, context)
  },
  async checkTree(context) {
    const used = await typesOf(context, "okforest/unused-type")
    // One finding a type, on its schema (or its template, without one),
    // naming every file it has.
    const unused = new Map<string, ReturnType<typeof typeFiles>>()
    for (const each of typeFiles(context)) {
      if (used.has(each.name)) continue
      unused.set(each.name, [...(unused.get(each.name) ?? []), each])
    }
    for (const [name, files] of unused) {
      const first = files[0] as (typeof files)[number]
      const names = files.map((each) => `\`${each.path.split("/").pop()}\``).join(" and ")
      context.report({
        file: first.path,
        ...at(first, first.key),
        message: `No concept in this tree has the type \`${name}\`: if none will, remove ${names}.`,
      })
    }
  },
}

/** In a tree that describes its types with schemas, a type without one is
 * checked by nothing, and its pages start from nothing. A tree with no
 * schemas has chosen not to, so it's left alone, as is OKF's own Attested
 * Computation. */
export const undeclaredType: Rule = {
  id: "okforest/undeclared-type",
  severity: "info",
  description:
    "In a tree with type schemas, each type its concepts give has one in `.okforest/types/`.",
  async checkFile(file, context) {
    await recordType("okforest/undeclared-type", file, context)
  },
  async checkTree(context) {
    const schemas = new Set(context.outline.types.flatMap((schema) => schema.name ?? []))
    if (schemas.size === 0) return
    const types = await typesOf(context, "okforest/undeclared-type")
    // Near-duplicates are okforest/similar-type's: in a group with a type
    // that has a schema, every other spelling is a misspelling of it; in a
    // group without one, only the most used spelling needs a schema.
    const misspelled = new Set<string>()
    const groups = findNearDuplicates(
      [
        ...[...types].map(([value, use]) => ({ value, count: use.count })),
        ...[...schemas].filter((name) => !types.has(name)).map((value) => ({ value, count: 0 })),
      ],
      "type",
    )
    for (const group of groups) {
      const values = group.values.map((each) => each.value)
      const kept = values.some((value) => schemas.has(value))
        ? undefined
        : [...group.values].sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1))[0]
            ?.value
      for (const value of values) if (value !== kept) misspelled.add(value)
    }
    for (const [type, use] of types) {
      // OKF defines this one's fields itself (§10), and okf/attested-computation
      // checks them.
      if (schemas.has(type) || misspelled.has(type) || type === "Attested Computation") continue
      const { count, ...where } = use
      context.report({
        ...where,
        message: `\`${type}\` (${concepts(count)}) has no schema in \`${TYPES_FOLDER}\`, so its fields aren't checked: add \`${TYPES_FOLDER}${typeSlug(type)}.schema.json\` (\`okforest types init\` drafts it).`,
      })
    }
  },
}

/** A type's schema and template are named for it, so people find them, and
 * tools find a type's files by its name. */
export const typeFileName: Rule = {
  id: "okforest/type-file-name",
  severity: "warning",
  description:
    "A type's schema and template in `.okforest/types/` are named for it: `Customer Profile` in `customer-profile.schema.json` and `customer-profile.template.md`.",
  checkTree(context) {
    for (const each of typeFiles(context)) {
      const suffix = each.kind === "schema" ? ".schema.json" : ".template.md"
      const expected = `${typeSlug(each.name)}${suffix}`
      const actual = each.path.slice(each.path.lastIndexOf("/") + 1)
      if (actual === expected) continue
      context.report({
        file: each.path,
        ...at(each, each.key),
        message: `This ${each.kind} is for \`${each.name}\`, so name it \`${expected}\`, or make its \`${each.key[0]}\` the type its name says.`,
      })
    }
  },
}
