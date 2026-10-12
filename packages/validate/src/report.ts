import type { Finding, ValidationResult } from "./types.js"

/** Version of the {@link ValidationReport} document; bumped on breaking changes. */
export const REPORT_SCHEMA_VERSION = 1

/**
 * A validation result as a self-describing JSON document: what `okforest
 * validate --format json` prints and the GitHub Action writes, so tools can
 * consume either. A public interface: change it only with a schema version bump.
 */
export interface ValidationReport {
  schemaVersion: typeof REPORT_SCHEMA_VERSION
  /** The program that produced the report. */
  tool: { name: string; version: string }
  /** The tree's path, as the user gave it. */
  path: string
  summary: {
    ok: boolean
    errors: number
    warnings: number
    infos: number
    concepts: number
    files: number
  }
  findings: Finding[]
}

export function toReport(
  result: ValidationResult,
  context: { tool: { name: string; version: string }; path: string },
): ValidationReport {
  const { findings, errors, warnings, infos, concepts, files, ok } = result
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    tool: { name: context.tool.name, version: context.tool.version },
    path: context.path,
    summary: { ok, errors, warnings, infos, concepts, files },
    findings,
  }
}
