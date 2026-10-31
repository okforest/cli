export { normalizeText } from "./document.js"
export {
  buildInventory,
  type Count,
  editDistance,
  findNearDuplicates,
  type Inventory,
  type NearDuplicates,
} from "./inventory.js"
export { visit } from "./markdown.js"
export { globToRegExp } from "./paths.js"
export {
  isTypeSchemaPath,
  outlineTree,
  parseTree,
  readTypeSchema,
  SETTINGS_PATH,
  TYPES_FOLDER,
} from "./tree.js"
export {
  deriveStatus,
  deriveTrustTier,
  isStaleAt,
  isStatus,
  normalizeSources,
  normalizeVerified,
} from "./trust.js"
export type * from "./types.js"
export { isRecord } from "./yaml.js"
