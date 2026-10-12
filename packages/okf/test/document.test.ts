import { normalizeText, parseTree } from "../src/index.js"

const read = (text: string, path = "a.md") => {
  const tree = parseTree([{ path, text }])
  const file = tree.concepts[0] ?? tree.reserved[0]
  if (!file) throw new Error("no file parsed")
  return file
}

describe("frontmatter", () => {
  it("parses a mapping and records where the body starts", () => {
    const file = read("---\ntype: Metric\ntitle: Revenue\n---\n# Definition\n")
    expect(file.hasFrontmatter).toBe(true)
    expect(file.frontmatter).toEqual({ type: "Metric", title: "Revenue" })
    expect(file.frontmatterError).toBeUndefined()
    expect(file.bodyStartLine).toBe(5)
  })

  it("treats a file without a leading --- line as having no frontmatter", () => {
    const file = read("# Title\n\n---\ntype: x\n---\n")
    expect(file.hasFrontmatter).toBe(false)
    expect(file.frontmatter).toBeUndefined()
    expect(file.bodyStartLine).toBe(1)
  })

  it("reports an unclosed block", () => {
    const file = read("---\ntype: Metric\n# Body\n")
    expect(file.frontmatter).toBeUndefined()
    expect(file.frontmatterError).toMatchObject({
      line: 1,
      message: expect.stringMatching(/not closed/),
    })
  })

  it("reports invalid YAML at the file line where it occurs", () => {
    const file = read("---\ntype: Metric\ntags: [a, b\n---\n")
    expect(file.frontmatter).toBeUndefined()
    expect(file.frontmatterError?.message).toMatch(/^Invalid YAML: /)
    expect(file.frontmatterError?.line).toBeGreaterThanOrEqual(3)
  })

  it("rejects duplicate keys as ambiguous", () => {
    const file = read("---\ntype: Metric\ntype: Policy\n---\n")
    expect(file.frontmatterError).toMatchObject({ line: 3 })
  })

  it("requires a mapping", () => {
    expect(read("---\n- a\n- b\n---\n").frontmatterError?.message).toMatch(/mapping/)
  })

  it("reads an empty block as an empty mapping", () => {
    const file = read("---\n---\nbody\n")
    expect(file.frontmatter).toEqual({})
    expect(file.frontmatterError).toBeUndefined()
  })

  it("keeps YAML 1.2 timestamps and yes/no as strings", () => {
    const file = read(
      "---\ntype: x\nstale_after: 2026-12-31T00:00:00Z\nflag: yes\nversion: 0.2\n---\n",
    )
    expect(file.frontmatter).toEqual({
      type: "x",
      stale_after: "2026-12-31T00:00:00Z",
      flag: "yes",
      version: 0.2,
    })
  })

  it("accepts trailing spaces on delimiters, a BOM, and CRLF line endings", () => {
    const file = read("﻿--- \r\ntype: Metric\r\n---\t\r\nBody [x](b.md)\r\n")
    expect(file.frontmatter).toEqual({ type: "Metric" })
    expect(file.text.startsWith("---")).toBe(true)
    expect(file.links[0]).toMatchObject({ line: 4, column: 6 })
  })

  it("locates keys and sequence items by file line", () => {
    const file = read(
      [
        "---",
        "type: Metric",
        "verified:",
        "  - { by: human:jane, at: 2026-06-25T09:00:00Z }",
        "sources:",
        "  - id: s1",
        "    resource: https://acme.example/s1",
        "---",
      ].join("\n"),
    )
    expect(file.locate(["type"])).toEqual({ line: 2, column: 1 })
    expect(file.locate(["verified", 0])).toEqual({ line: 4, column: 5 })
    expect(file.locate(["sources", 0, "resource"])).toEqual({ line: 7, column: 5 })
    expect(file.locate(["missing"])).toBeUndefined()
    expect(file.locate(["type", "deeper"])).toBeUndefined()
    expect(file.locate(["sources", 5])).toBeUndefined()
  })

  it("locates nothing when there is no frontmatter", () => {
    expect(read("# Just a body\n").locate(["type"])).toBeUndefined()
  })
})

describe("body", () => {
  it("reports positions relative to the whole file", () => {
    const file = read(
      [
        "---",
        "type: Metric",
        "---",
        "",
        "See [orders](/tables/orders.md) and ![chart](chart.png).",
        "",
        "A claim.[^src]",
        "",
        "[^src]: Source",
        "",
        "```d2",
        "a -> b",
        "```",
        "",
        "    SELECT 1",
        "",
        "[ref link][r]",
        "",
        "[r]: ./other.md",
      ].join("\n"),
    )
    expect(file.links.map((l) => [l.target, l.line, l.column, l.image])).toEqual([
      ["/tables/orders.md", 5, 5, false],
      ["chart.png", 5, 37, true],
      ["./other.md", 17, 1, false],
    ])
    expect(file.footnotes).toEqual([{ label: "src", line: 7, column: 9 }])
    expect(file.codeBlocks).toEqual([
      { lang: "d2", value: "a -> b", line: 11, contentLine: 12 },
      { value: "SELECT 1", line: 15, contentLine: 15 },
    ])
  })

  it("does not read the frontmatter as markdown", () => {
    const file = read('---\ntype: x\ndescription: "[not a link](x.md)"\n---\n')
    expect(file.links).toEqual([])
    expect(file.ast.children).toEqual([])
  })
})

describe("normalizeText", () => {
  it("removes a BOM and normalizes CR and CRLF", () => {
    expect(normalizeText("﻿a\r\nb\rc\n")).toBe("a\nb\nc\n")
  })
})
