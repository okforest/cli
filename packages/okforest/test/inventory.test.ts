import { run } from "./helpers.js"

describe("okforest inventory", () => {
  it("lists types, tags, keys, and near-duplicates", async () => {
    const result = await run(["inventory", "okf-samples/ga4"])
    expect(result.code).toBe(0)
    expect(result.stdout).toMatchSnapshot()
  })

  it("notes untyped concepts and empty sections", async () => {
    const result = await run(["inventory", "rules/okf/frontmatter"], { color: true })
    expect(result.stdout).toContain("concepts have no usable type")
    expect(result.stdout).toContain("(none)")
    expect(result.stdout).toContain("(none found)")
  })

  it("writes JSON", async () => {
    const result = await run(["inventory", "okf-samples/acme_retail", "--format", "json"])
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: 1,
      tool: { name: "okforest" },
      path: "okf-samples/acme_retail",
      concepts: 9,
      trustTiers: { "human-reviewed": 8, unverified: 1 },
    })
  })

  it("rejects a bad format", async () => {
    expect(await run(["inventory", "valid", "--format", "yaml"])).toMatchObject({ code: 2 })
  })
})
