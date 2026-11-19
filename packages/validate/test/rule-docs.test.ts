import { defaultRules, ruleDocs } from "../src/index.js"
import { validateFiles } from "./helpers.js"

// Every documented example must break its rule exactly as its page says, and
// its fix must leave the tree with no findings at all. An example of a rule
// that applies only to OKF 0.2 declares 0.2 on purpose, so the warning that
// 0.3 is current is left to that rule's own example.
const options = (id: string) =>
  id === "okforest/okf-version-current"
    ? {}
    : { severity: { "okforest/okf-version-current": "off" as const } }

describe("rule docs", () => {
  it("documents only rules that exist", () => {
    const ids = new Set(defaultRules.map((rule) => rule.id))
    expect(Object.keys(ruleDocs).filter((id) => !ids.has(id))).toEqual([])
  })

  it.each(Object.entries(ruleDocs))("%s: the example fails as shown", async (id, docs) => {
    const { file, fails, findings, context = {} } = docs.example
    const result = await validateFiles({ ...context, [file]: fails }, options(id))
    expect(
      result.findings.map(
        (f) => `${f.ruleId} ${f.file} ${f.line ?? "-"}:${f.column ?? "-"} ${f.message}`,
      ),
    ).toEqual(findings.map((finding) => `${id} ${file} ${finding}`))
  })

  const fixable = Object.entries(ruleDocs).filter(([, docs]) => docs.example.fixed !== undefined)
  it.each(fixable)("%s: the fix passes", async (id, docs) => {
    const { file, fixed, fixedFile = file, context = {} } = docs.example
    const result = await validateFiles({ ...context, [fixedFile]: fixed }, options(id))
    expect(result.findings).toEqual([])
  })
})
