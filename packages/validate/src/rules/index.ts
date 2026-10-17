import type { Rule } from "../types.js"
import {
  frontmatter,
  indexEntries,
  indexFrontmatter,
  logDate,
  logOrder,
  okfVersion,
  type,
} from "./conformance.js"
import { d2Syntax, diagramUnchecked, mermaidSyntax } from "./diagrams.js"
import {
  actor,
  attestedComputation,
  datetime,
  description,
  fieldTypes,
  generated,
  legacy,
  sources,
  status,
  title,
  verified,
} from "./fields.js"
import { brokenLink, footnoteSource } from "./links.js"
import { placeholder, settingsFile, settingsKeys, slug, wikilink } from "./okforest.js"

/** Rules from the OKF v0.2 specification. */
export const okfRules: readonly Rule[] = [
  frontmatter,
  type,
  indexFrontmatter,
  indexEntries,
  logDate,
  logOrder,
  okfVersion,
  generated,
  verified,
  sources,
  status,
  datetime,
  attestedComputation,
  title,
  description,
  fieldTypes,
  actor,
  brokenLink,
  footnoteSource,
  legacy,
]

/** OKForest conventions beyond the spec: slugs, placeholders, settings, diagrams. */
export const okforestRules: readonly Rule[] = [
  settingsFile,
  settingsKeys,
  slug,
  placeholder,
  wikilink,
  d2Syntax,
  mermaidSyntax,
  diagramUnchecked,
]

export const defaultRules: readonly Rule[] = [...okfRules, ...okforestRules]
