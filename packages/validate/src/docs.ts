/** Where each rule's documentation lives: one page per rule ID on the OKForest
 * site, generated from this package's rule list. */
export const RULE_DOCS_URL = "https://www.okforest.ai/docs/rules/"

/** The documentation page for a rule (`okf/type` →
 * `https://www.okforest.ai/docs/rules/okf/type/`). */
export function ruleUrl(ruleId: string): string {
  return `${RULE_DOCS_URL}${ruleId}/`
}
