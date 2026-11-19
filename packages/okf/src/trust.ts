import type { Source, Status, TrustTier, Verification } from "./types.js"
import { isRecord } from "./yaml.js"

/** The statuses OKF defines (spec §5.4). */
const STATUSES: readonly Status[] = ["draft", "stable", "deprecated"]

/** Lifecycle status (spec §5.4): absent (or null, or blank, §11.2) means
 * `stable`; a value OKF doesn't define is `unrecognized`, which isn't
 * `stable`, so filters to current knowledge leave it out. */
export function deriveStatus(value: unknown): Status | "unrecognized" {
  if (isAbsent(value)) return "stable"
  return STATUSES.includes(value as Status) ? (value as Status) : "unrecognized"
}

/** Whether a value is one of the statuses OKF defines. */
export function isStatus(value: unknown): value is Status {
  return STATUSES.includes(value as Status)
}

/**
 * A timestamp as OKF writes it (spec §5): an RFC 3339 date-time with an
 * offset, or a date only, which is the start of that day in UTC. Milliseconds
 * since the epoch, or undefined for any other form (a date-time without an
 * offset, a date that doesn't exist, a number).
 */
export function parseTimestamp(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-]\d{2}:\d{2}))?$/.exec(
      value.trim(),
    )
  if (!match) return undefined
  const [, year, month, day, hour, minute, second] = match
  const date = Date.UTC(Number(year), Number(month) - 1, Number(day))
  const check = new Date(date)
  if (check.getUTCMonth() !== Number(month) - 1 || check.getUTCDate() !== Number(day)) {
    return undefined
  }
  if (hour === undefined) return date
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 60) return undefined
  // The pattern requires an offset with a time, so this reads one instant.
  const instant = Date.parse(value.trim().replace(" ", "T"))
  return Number.isNaN(instant) ? undefined : instant
}

/**
 * Verification events (spec §5.2). A bare `{ by, at }` mapping is a
 * one-element list; entries without a string `by` are skipped. `at` is kept
 * as written: {@link currentVerifications} needs it to count an event.
 */
export function normalizeVerified(value: unknown): Verification[] {
  const entries = Array.isArray(value) ? value : value === undefined ? [] : [value]
  return entries.flatMap((entry) =>
    isRecord(entry) && typeof entry.by === "string" && entry.by !== ""
      ? [{ by: entry.by, ...(typeof entry.at === "string" ? { at: entry.at } : {}) }]
      : [],
  )
}

/**
 * The verification events that count (spec §5.3): those with a timestamp
 * `at` on or after `generated.at`, the last change to the content, or every
 * timed event when there's no such change to compare with. An event without
 * a readable `at` never counts (§5.2).
 */
export function currentVerifications(
  verified: readonly Verification[],
  generatedAt?: unknown,
): Verification[] {
  const changed = parseTimestamp(generatedAt)
  return verified.filter((v) => {
    const at = parseTimestamp(v.at)
    return at !== undefined && (changed === undefined || at >= changed)
  })
}

/** Trust tier (spec §5.3), from the current verification events only, so a
 * page an agent rewrote after a person's review isn't human-reviewed until
 * someone confirms it again: a current `human:` verifier ⇒ human-reviewed;
 * other current verifiers only ⇒ machine-confirmed; none ⇒ unverified. */
export function deriveTrustTier(
  verified: readonly Verification[],
  generatedAt?: unknown,
): TrustTier {
  const current = currentVerifications(verified, generatedAt)
  if (current.some((v) => v.by.startsWith("human:"))) return "human-reviewed"
  return current.length > 0 ? "machine-confirmed" : "unverified"
}

/** Whether `now >= staleAfter` (spec §5.5). Absent (or null, or blank) is
 * never stale; a value that isn't a timestamp is never fresh, since it can't
 * say the content is still current. */
export function isStaleAt(staleAfter: unknown, now: Date): boolean {
  if (isAbsent(staleAfter)) return false
  const instant = parseTimestamp(staleAfter)
  return instant === undefined || now.getTime() >= instant
}

/** `sources` entries (spec §5.1): a bare mapping is a one-element list
 * (§11.2). Fields hold the values as written when they have the expected
 * type. */
export function normalizeSources(value: unknown): Source[] {
  const entries = Array.isArray(value) ? value : isRecord(value) ? [value] : []
  return entries.filter(isRecord).map((entry) => {
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

/** Whether a value counts as absent (spec §11.2): undefined, null, an empty
 * or blank string, or an empty list. */
export function isAbsent(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  )
}
