import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { defaultRules } from "../src/index.js"
import { FIXTURES, lines, validateDir } from "./helpers.js"

// Every rule has a hand-made failing tree at fixtures/rules/<rule id>/; the
// snapshot records exactly what the validator reports for it.
describe("rule fixtures", () => {
  it("has a fixture for every rule, and a rule for every fixture", () => {
    const ids = defaultRules.map((r) => r.id).sort()
    const fixtures = readdirSync(join(FIXTURES, "rules")).flatMap((namespace) =>
      readdirSync(join(FIXTURES, "rules", namespace)).map((name) => `${namespace}/${name}`),
    )
    expect(fixtures.sort()).toEqual(ids)
  })

  it.each(defaultRules.map((r) => r.id))("%s", async (id) => {
    const dir = join(FIXTURES, "rules", id)
    expect(existsSync(dir)).toBe(true)
    const result = await validateDir(dir)
    expect(result.findings.some((f) => f.ruleId === id)).toBe(true)
    expect(lines(result.findings)).toMatchSnapshot()
  })

  it("reports nothing for a clean tree that exercises every family", async () => {
    const result = await validateDir(join(FIXTURES, "valid"))
    expect(lines(result.findings)).toEqual([])
    expect(result).toMatchObject({
      ok: true,
      errors: 0,
      warnings: 0,
      infos: 0,
      concepts: 4,
      files: 8,
    })
  })
})
