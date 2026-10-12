import { join } from "node:path"
import { parseTree } from "@okforest/okf"
import { readTree } from "@okforest/okf/node"
import { type Finding, type ValidateOptions, validate } from "../src/index.js"

export const FIXTURES = join(import.meta.dirname, "..", "..", "..", "fixtures")

/** A fixed instant, so staleness never changes a snapshot. */
export const NOW = new Date("2026-10-11T00:00:00Z")

/** One finding per line, as a reviewer would read it. */
export const lines = (findings: readonly Finding[]) =>
  findings.map(
    (f) => `${f.file}:${f.line ?? "-"}:${f.column ?? "-"} ${f.severity} ${f.ruleId} ${f.message}`,
  )

export const validateDir = async (dir: string, options: ValidateOptions = {}) =>
  validate(await readTree(dir), { now: NOW, ...options })

/** Validate an in-memory tree given as `{ path: text }`. */
export const validateFiles = (
  files: Record<string, string | undefined>,
  options: ValidateOptions = {},
) =>
  validate(
    parseTree(
      Object.entries(files).map(([path, text]) => (text === undefined ? { path } : { path, text })),
    ),
    { now: NOW, ...options },
  )

/** A concept with a type, title, and description, plus extra frontmatter and a body. */
export const concept = (extra = "", body = "") =>
  `---\ntype: Note\ntitle: Example\ndescription: An example.\n${extra ? `${extra}\n` : ""}---\n\n${body}\n`

/** Findings of one rule, as lines. */
export const only = async (ruleId: string, files: Record<string, string | undefined>) =>
  lines((await validateFiles(files)).findings.filter((f) => f.ruleId === ruleId))
