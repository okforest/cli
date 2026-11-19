/** The newest OKF version this package reads (spec §12). */
export const LATEST_OKF_VERSION = "0.3"

/** An OKF version, `<major>.<minor>` (spec §12). */
export interface OkfVersion {
  major: number
  minor: number
}

/** The OKF version an `okf_version` value names, or undefined when it names
 * none. A number counts as written (`okf_version: 0.3`, unquoted). */
export function parseOkfVersion(value: unknown): OkfVersion | undefined {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value : ""
  const match = /^(\d+)\.(\d+)$/.exec(text.trim())
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : undefined
}

/** Whether an `okf_version` value names `version` or a later one. A bundle
 * that declares no version reads as 0.2 or earlier (spec §12.1), so this is
 * false for it. */
export function okfVersionAtLeast(value: unknown, version: string): boolean {
  const declared = parseOkfVersion(value)
  const wanted = parseOkfVersion(version)
  if (!declared || !wanted) return false
  return (
    declared.major > wanted.major ||
    (declared.major === wanted.major && declared.minor >= wanted.minor)
  )
}
