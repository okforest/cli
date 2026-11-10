import type { KeyPath } from "@okforest/okf"
import type { Rule } from "../types.js"
import { show } from "../util.js"

/** A type's template in `.okforest/types/` is what a new concept of the type
 * starts as (`okforest new`, and OKForest's new-page form); one that can't be
 * used would be skipped without a word. */
export const typeTemplate: Rule = {
  id: "okforest/type-template",
  severity: "error",
  description:
    "Each type template in `.okforest/types/` starts with front matter naming its `type`, and a type has one template.",
  checkTree({ outline, report }) {
    const firstPath = new Map<string, string>()
    for (const template of outline.templates) {
      const problem = (path: KeyPath, message: string) =>
        report({
          file: template.path,
          ...(template.locate(path) ?? { line: 1, column: 1 }),
          message,
        })
      if (template.frontmatterError) {
        report({ file: template.path, ...template.frontmatterError })
        continue
      }
      if (!template.hasFrontmatter) {
        problem(
          [],
          "A type template starts with front matter between `---` lines, naming the type it's for (`type: Metric`).",
        )
        continue
      }
      if (template.name === undefined) {
        problem(
          template.frontmatter?.type === undefined ? [] : ["type"],
          "A type template needs a `type`: the type it's for, as concepts write it.",
        )
        continue
      }
      const earlier = firstPath.get(template.name)
      if (earlier) {
        problem(
          ["type"],
          `${earlier} is already the template for ${show(template.name)}; a type has one template.`,
        )
        continue
      }
      firstPath.set(template.name, template.path)
    }
  },
}
