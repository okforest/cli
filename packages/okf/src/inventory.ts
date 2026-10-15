import type { Status, Tree, TrustTier } from "./types.js"

/** A value in use and how many concepts use it. */
export interface Count {
  value: string
  count: number
}

/** Values that are probably meant to be the same thing. */
export interface NearDuplicates {
  field: "type" | "tag" | "key"
  /** The variants, most used first. */
  values: Count[]
  /** Why they were grouped: identical apart from case and punctuation,
   * singular versus plural, or a small spelling difference. */
  reasons: ("case-or-punctuation" | "plural" | "spelling")[]
}

/** The metadata inventory: every type, tag, and frontmatter key in use. */
export interface Inventory {
  concepts: number
  /** Concepts with no usable `type`. */
  untyped: number
  types: Count[]
  tags: Count[]
  /** Top-level frontmatter keys. */
  keys: Count[]
  statuses: Record<Status, number>
  trustTiers: Record<TrustTier, number>
  /** Concepts past their `stale_after` instant. */
  stale: number
  nearDuplicates: NearDuplicates[]
}

/** Build the metadata inventory of a tree. Deterministic: no model calls. */
export function buildInventory(tree: Tree, options: { now?: Date } = {}): Inventory {
  const now = options.now ?? new Date()
  const types = new Map<string, number>()
  const tags = new Map<string, number>()
  const keys = new Map<string, number>()
  const statuses: Record<Status, number> = { draft: 0, stable: 0, deprecated: 0 }
  const trustTiers: Record<TrustTier, number> = {
    unverified: 0,
    "machine-confirmed": 0,
    "human-reviewed": 0,
  }
  let untyped = 0
  let stale = 0
  const bump = (map: Map<string, number>, value: string) =>
    map.set(value, (map.get(value) ?? 0) + 1)

  for (const concept of tree.concepts) {
    if (concept.type) bump(types, concept.type)
    else untyped++
    for (const tag of new Set(concept.tags)) bump(tags, tag)
    for (const key of Object.keys(concept.frontmatter ?? {})) bump(keys, key)
    statuses[concept.status]++
    trustTiers[concept.trustTier]++
    if (concept.isStale(now)) stale++
  }

  const typeCounts = sorted(types)
  const tagCounts = sorted(tags)
  const keyCounts = sorted(keys)
  return {
    concepts: tree.concepts.length,
    untyped,
    types: typeCounts,
    tags: tagCounts,
    keys: keyCounts,
    statuses,
    trustTiers,
    stale,
    nearDuplicates: [
      ...findNearDuplicates(typeCounts, "type"),
      ...findNearDuplicates(tagCounts, "tag"),
      ...findNearDuplicates(keyCounts, "key"),
    ],
  }
}

/** Most used first; ties in code-point order, so output is the same on every machine. */
function sorted(map: Map<string, number>): Count[] {
  return [...map]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0))
}

/**
 * Group values that are likely variants of one another, using string
 * comparison only (semantic synonyms such as `Client` and `Customer` need a
 * declared registry or an AI suggestion):
 *
 * - case and punctuation: `SaaS Application`, `saas-application`;
 * - singular and plural: `Policy`, `Policies`;
 * - spelling: an edit distance of 1 (values of 5+ characters) or 2 (10+),
 *   unless one value contains the other.
 */
export function findNearDuplicates(
  counts: readonly Count[],
  field: NearDuplicates["field"],
): NearDuplicates[] {
  const parent = counts.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i] as number] as number
    return i
  }
  const reasons = new Map<number, Set<NearDuplicates["reasons"][number]>>()
  const union = (a: number, b: number, reason: NearDuplicates["reasons"][number]) => {
    const ra = find(a)
    const rb = find(b)
    const merged = new Set([...(reasons.get(ra) ?? []), ...(reasons.get(rb) ?? []), reason])
    if (ra !== rb) parent[rb] = ra
    reasons.set(ra, merged)
  }

  const folded = counts.map((c) => c.value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))
  const singular = folded.map(singularize)
  for (let i = 0; i < counts.length; i++) {
    for (let j = i + 1; j < counts.length; j++) {
      const a = folded[i] as string
      const b = folded[j] as string
      if (a === "" || b === "") continue
      if (a === b) union(i, j, "case-or-punctuation")
      else if (singular[i] === singular[j]) union(i, j, "plural")
      // A word added to the other (`active-users`, `inactive-users`) changes the
      // meaning rather than misspelling it, so containment is never a typo.
      else if (!a.includes(b) && !b.includes(a)) {
        const shortest = Math.min(a.length, b.length)
        const allowed = shortest >= 10 ? 2 : shortest >= 5 ? 1 : 0
        if (allowed > 0 && editDistance(a, b, allowed) <= allowed) union(i, j, "spelling")
      }
    }
  }

  const groups = new Map<number, number[]>()
  counts.forEach((_, i) => {
    const root = find(i)
    groups.set(root, [...(groups.get(root) ?? []), i])
  })
  const order = ["case-or-punctuation", "plural", "spelling"] as const
  return [...groups]
    .filter(([, members]) => members.length > 1)
    .map(([root, members]) => ({
      field,
      values: members.map((i) => counts[i] as Count),
      reasons: order.filter((r) => reasons.get(root)?.has(r)),
    }))
}

function singularize(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`
  if (/(?:ses|xes|zes|ches|shes)$/.test(word)) return word.slice(0, -2)
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1)
  return word
}

/** Levenshtein distance, stopping early once it exceeds `limit`. */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(
        (previous[j] as number) + 1,
        (current[j - 1] as number) + 1,
        (previous[j - 1] as number) + cost,
      )
      current.push(value)
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin > limit) return limit + 1
    previous = current
  }
  return previous[b.length] as number
}
