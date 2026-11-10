import { type Count, findNearDuplicates, type KeyPath } from "@okforest/okf"
import type { CheckContext, Rule } from "../types.js"
import { at } from "../util.js"

/** Where one value is written: a concept's `type`, or one of its tags. */
interface Use {
  file: string
  line: number
  column: number
}

/** Every value of one field in the tree, by value, with where it's written. */
type Uses = Map<string, Use[]>

/** This run's uses of a field, gathered a file at a time and read once every
 * file is checked. */
const usesOf = (context: CheckContext, field: "type" | "tag") =>
  context.once<Uses>(`okforest/similar-${field}`, async () => new Map())

const record = (uses: Uses, value: string, use: Use) => {
  const list = uses.get(value)
  if (list) list.push(use)
  else uses.set(value, [use])
}

/** OKF's examples write a type as capitalized words with spaces (`BigQuery
 * Table`), and tags in lowercase with hyphens (`income-statement`). */
const CONVENTIONAL = {
  type: /^\p{Lu}[\p{L}\p{N}]*(?: [\p{Lu}\p{N}][\p{L}\p{N}]*)*$/u,
  tag: /^[\p{Ll}\p{N}]+(?:-[\p{Ll}\p{N}]+)*$/u,
}

/** A value and what speaks for it: its uses, and for a type, its schema. */
interface Candidate extends Count {
  schema: boolean
  conventional: boolean
}

/** Which of two candidates is more likely the one meant: the one with a
 * schema, then the more used, then the one written as OKF's examples are. */
const rank = (a: Candidate, b: Candidate) =>
  Number(b.schema) - Number(a.schema) ||
  b.count - a.count ||
  Number(b.conventional) - Number(a.conventional)

const concepts = (count: number) => `${count} ${count === 1 ? "concept" : "concepts"}`

const evidence = (candidate: Candidate) =>
  [candidate.count > 0 && concepts(candidate.count), candidate.schema && "a schema"]
    .filter(Boolean)
    .join(" and ")

/**
 * Report each use of a value that nearly matches a more likely one, as
 * `findNearDuplicates` groups them (`okforest inventory` lists the same
 * groups): each value in a group that another outranks points at the group's
 * best. A group with no clear best (one use each, written alike) says nothing.
 */
function reportSimilar(
  context: CheckContext,
  field: "type" | "tag",
  uses: Uses,
  schemas: ReadonlySet<string>,
) {
  const counts = [...uses].map(([value, list]) => ({ value, count: list.length }))
  for (const value of schemas) if (!uses.has(value)) counts.push({ value, count: 0 })
  const label = field === "type" ? "Type" : "Tag"
  for (const group of findNearDuplicates(counts, field)) {
    const candidates = group.values
      .map((c) => ({
        ...c,
        schema: schemas.has(c.value),
        conventional: CONVENTIONAL[field].test(c.value),
      }))
      // A group's values are distinct, so code-point order settles any tie.
      .sort((a, b) => rank(a, b) || (a.value < b.value ? -1 : 1))
    const best = candidates[0] as Candidate
    for (const candidate of candidates.slice(1)) {
      if (candidate.schema || rank(best, candidate) === 0) continue
      const message = `${label} \`${candidate.value}\` (${concepts(candidate.count)}) looks like \`${best.value}\` (${evidence(best)}): did you mean \`${best.value}\`?`
      // Only a schema's type can have no uses, and it's never reported.
      for (const use of uses.get(candidate.value) as Use[]) context.report({ ...use, message })
    }
  }
}

/** A type written two ways is two types to OKF: the variant is missed by
 * filters, and by its type's schema. */
export const similarType: Rule = {
  id: "okforest/similar-type",
  severity: "warning",
  description:
    "A concept's `type` isn't a near-duplicate (case, punctuation, plural, or spelling) of a type more concepts use, or one with a schema.",
  async checkFile(file, context) {
    if (file.kind !== "concept" || !file.type) return
    record(await usesOf(context, "type"), file.type, { file: file.path, ...at(file, ["type"]) })
  },
  async checkTree(context) {
    const schemas = new Set(context.outline.types.flatMap((schema) => schema.name ?? []))
    reportSimilar(context, "type", await usesOf(context, "type"), schemas)
  },
}

/** A tag written two ways splits its concepts in two. */
export const similarTag: Rule = {
  id: "okforest/similar-tag",
  severity: "warning",
  description:
    "A concept's tags aren't near-duplicates (case, punctuation, plural, or spelling) of tags more concepts use.",
  async checkFile(file, context) {
    if (file.kind !== "concept" || file.tags.length === 0) return
    const uses = await usesOf(context, "tag")
    const raw = file.frontmatter?.tags
    for (const tag of new Set(file.tags)) {
      const index = Array.isArray(raw) ? raw.indexOf(tag) : -1
      const path: KeyPath = index === -1 ? ["tags"] : ["tags", index]
      record(uses, tag, { file: file.path, ...at(file, path) })
    }
  },
  async checkTree(context) {
    reportSimilar(context, "tag", await usesOf(context, "tag"), new Set())
  },
}
