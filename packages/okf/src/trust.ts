import type { Source, Status, TrustTier, Verification } from "./types.js"
import { isRecord } from "./yaml.js"

const STATUSES: readonly Status[] = ["draft", "stable", "deprecated"]

/** Lifecycle status (spec §5.4): absent, or not a recognized value, means `stable`. */
export function deriveStatus(value: unknown): Status {
  return STATUSES.includes(value as Status) ? (value as Status) : "stable"
}

export function isStatus(value: unknown): value is Status {
  return STATUSES.includes(value as Status)
}

/**
 * Verification events (spec §5.2). A bare `{ by, at }` mapping is a
 * one-element list; entries without a string `by` are skipped.
 */
export function normalizeVerified(value: unknown): Verification[] {
  const entries = Array.isArray(value) ? value : value === undefined ? [] : [value]
  return entries.flatMap((entry) =>
    isRecord(entry) && typeof entry.by === "string" && entry.by !== ""
      ? [{ by: entry.by, ...(typeof entry.at === "string" ? { at: entry.at } : {}) }]
      : [],
  )
}

/** Trust tier (spec §5.3): `human:` verifiers ⇒ human-reviewed; any other
 * verifier ⇒ machine-confirmed; none ⇒ unverified. */
export function deriveTrustTier(verified: readonly Verification[]): TrustTier {
  if (verified.some((v) => v.by.startsWith("human:"))) return "human-reviewed"
  return verified.length > 0 ? "machine-confirmed" : "unverified"
}

/** Whether `now >= staleAfter` (spec §5.5). Unparseable instants are never stale. */
export function isStaleAt(staleAfter: string | undefined, now: Date): boolean {
  if (staleAfter === undefined) return false
  const instant = Date.parse(staleAfter)
  return !Number.isNaN(instant) && now.getTime() >= instant
}

export function normalizeSources(value: unknown): Source[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((entry) => {
    const source: Source = {}
    if (typeof entry.id === "string") source.id = entry.id
    if (typeof entry.resource === "string") source.resource = entry.resource
    if (typeof entry.title === "string") source.title = entry.title
    if (typeof entry.author === "string") source.author = entry.author
    if (typeof entry.usage_count === "number") source.usageCount = entry.usage_count
    if (typeof entry.last_modified === "string") source.lastModified = entry.last_modified
    return source
  })
}
