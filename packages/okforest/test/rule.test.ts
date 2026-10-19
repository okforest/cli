import { defaultRules, ruleDocs } from "@okforest/validate"
import { run } from "./helpers.js"

describe("okforest rule", () => {
  it("explains a rule: why, the example, what validate reports, and the fix", async () => {
    const result = await run(["rule", "okf/broken-link"])
    expect(result.code).toBe(0)
    expect(result.stdout).toMatchSnapshot()
  })

  it("says when the fix is a rename, or there is nothing to fix", async () => {
    expect((await run(["rule", "okforest/slug"])).stdout).toContain(
      "Fixed, renamed to churn-rate.md",
    )
    const unchecked = (await run(["rule", "okforest/diagram-unchecked"])).stdout
    expect(unchecked).toContain("Nothing to fix")
    expect(unchecked).not.toContain("Fixed")
  })

  it("prints a finding about a whole file without a position", async () => {
    const result = await run(["rule", "okforest/slug"])
    expect(result.stdout).toContain("\n      warning  File name `Churn_Rate` is not a slug")
  })

  it("lists every rule without one", async () => {
    const result = await run(["rule"])
    expect(result.code).toBe(0)
    for (const rule of defaultRules) expect(result.stdout).toContain(rule.id)
    expect(result.stdout).toMatchSnapshot()
  })

  it("writes a rule, or every rule, as JSON", async () => {
    const one = JSON.parse((await run(["rule", "okf/type", "--format", "json"])).stdout)
    expect(one).toEqual({
      id: "okf/type",
      severity: "error",
      set: "OKF specification",
      description: expect.any(String),
      url: "https://www.okforest.ai/docs/rules/okf/type/",
      why: ruleDocs["okf/type"]?.why,
      example: ruleDocs["okf/type"]?.example,
    })
    const all = JSON.parse((await run(["rule", "--format", "json"])).stdout)
    expect(all).toHaveLength(defaultRules.length)
  })

  it("suggests the rule meant, for an unknown one", async () => {
    expect(await run(["rule", "okf/slug"])).toEqual({
      code: 2,
      stdout: "",
      stderr:
        "okforest: Unknown rule `okf/slug`. Did you mean `okforest/slug`? Run `okforest rule` to list them.\n",
    })
    expect((await run(["rule", "okf/typo"])).stderr).toContain("Did you mean `okf/type`?")
    expect((await run(["rule", "nothing/like-it"])).stderr).toBe(
      "okforest: Unknown rule `nothing/like-it`. Run `okforest rule` to list them.\n",
    )
  })

  it("takes one rule, and shows its help", async () => {
    expect((await run(["rule", "okf/type", "okf/title"])).code).toBe(2)
    expect((await run(["rule", "--help"])).stdout).toContain("Usage: okforest rule")
  })
})
