import type { Rule } from "../types.js"
import {
  frontmatter,
  indexEntries,
  indexFrontmatter,
  indexScope,
  logDate,
  logFrontmatter,
  logOrder,
  notAConcept,
  okfVersion,
  type,
} from "./conformance.js"
import { d2Syntax, diagramUnchecked, mermaidSyntax } from "./diagrams.js"
import {
  actor,
  attestedComputation,
  datetime,
  description,
  extensionKey,
  fieldTypes,
  generated,
  legacy,
  sources,
  status,
  title,
  verified,
} from "./fields.js"
import { brokenLink, footnoteSource } from "./links.js"
import {
  okfVersionCurrent,
  placeholder,
  settingsFile,
  settingsKeys,
  slug,
  wikilink,
} from "./okforest.js"
import { similarTag, similarType } from "./similar.js"
import { typeSchema } from "./type-schema.js"
import { typeTemplate } from "./type-template.js"
import { typeFileName, undeclaredType, unusedType } from "./type-usage.js"

/** Rules from the OKF specification, by the version a tree declares (0.2
 * and 0.3). */
export const okfRules: readonly Rule[] = [
  frontmatter,
  type,
  notAConcept,
  indexFrontmatter,
  indexEntries,
  indexScope,
  logDate,
  logOrder,
  logFrontmatter,
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
  extensionKey,
  actor,
  brokenLink,
  footnoteSource,
  legacy,
]

/** OKForest conventions beyond the spec: slugs, placeholders, settings, type
 * schemas and templates, near-duplicate types and tags, diagrams. */
export const okforestRules: readonly Rule[] = [
  okfVersionCurrent,
  settingsFile,
  settingsKeys,
  typeSchema,
  typeTemplate,
  typeFileName,
  unusedType,
  undeclaredType,
  similarType,
  similarTag,
  slug,
  placeholder,
  wikilink,
  d2Syntax,
  mermaidSyntax,
  diagramUnchecked,
]

export const defaultRules: readonly Rule[] = [...okfRules, ...okforestRules]
