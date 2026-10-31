/** The frontmatter keys OKF defines (§4.1, §5, §10.2). A type's schema
 * describes the type's own fields, so these are left out of it unless it
 * names them. */
export const OKF_FIELDS: readonly string[] = [
  "type",
  "title",
  "description",
  "resource",
  "tags",
  "sources",
  "usage_window",
  "generated",
  "verified",
  "status",
  "stale_after",
  "runtime",
  "parameters",
  "computation",
  "executor",
  "attester",
]
