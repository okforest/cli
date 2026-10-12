import { concept, only, validateFiles } from "./helpers.js"

const d2 = (source: string) => `\`\`\`d2\n${source}\n\`\`\``
const mermaid = (source: string) => `\`\`\`mermaid\n${source}\n\`\`\``

describe("diagram rules with the optional peers installed", () => {
  it("does nothing, and loads nothing, without diagram blocks", async () => {
    const result = await validateFiles({ "a.md": concept("", "```sql\nSELECT 1\n```") })
    expect(result.findings.filter((f) => f.ruleId.startsWith("okforest/d"))).toEqual([])
  })

  it("matches the language case-insensitively and checks index.md too", async () => {
    expect(
      await only("okforest/d2-syntax", { "index.md": "# A\n\n```D2\na -> {\n```\n" }),
    ).toHaveLength(2)
  })

  it("keeps end-of-input errors inside the block", async () => {
    expect(
      await only("okforest/mermaid-syntax", { "a.md": concept("", mermaid("graph TD\n  A -->")) }),
    ).toEqual([
      expect.stringMatching(
        /^a\.md:9:1 error okforest\/mermaid-syntax Mermaid syntax error: Parse error on line \d+: Expecting/,
      ),
    ])
  })

  it("reports an unknown Mermaid diagram type without a line", async () => {
    expect(
      await only("okforest/mermaid-syntax", { "a.md": concept("", mermaid("notADiagram\n  A")) }),
    ).toEqual([
      expect.stringMatching(/^a\.md:8:1 error okforest\/mermaid-syntax Mermaid syntax error: .+/),
    ])
  })

  it("passes valid D2 and Mermaid", async () => {
    const body = `${d2("a -> b: label")}\n\n${mermaid("sequenceDiagram\n  A->>B: hi")}`
    const result = await validateFiles({ "a.md": concept("", body) })
    expect(
      result.findings.filter(
        (f) => f.ruleId.startsWith("okforest/d") || f.ruleId.startsWith("okforest/m"),
      ),
    ).toEqual([])
  })
})
