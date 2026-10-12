import { parseTree } from "../src/index.js"

const tree = (files: Record<string, string | undefined>) =>
  parseTree(
    Object.entries(files).map(([path, text]) => (text === undefined ? { path } : { path, text })),
  )

const concept = (body = "", fm = "type: Note") => `---\n${fm}\n---\n${body}\n`

describe("parseTree", () => {
  it("classifies concepts and reserved files at any depth", () => {
    const t = tree({
      "index.md": '---\nokf_version: "0.2"\n---\n# Root\n',
      "log.md": "# Log\n",
      "tables/index.md": "# Tables\n",
      "tables/orders.md": concept(),
      "notes.md": concept(),
      "viz.html": undefined,
    })
    expect(t.concepts.map((c) => c.id)).toEqual(["notes", "tables/orders"])
    expect(t.reserved.map((r) => [r.path, r.kind, r.directory])).toEqual([
      ["index.md", "index", ""],
      ["log.md", "log", ""],
      ["tables/index.md", "index", "tables"],
    ])
    expect(t.files).toEqual([
      "index.md",
      "log.md",
      "notes.md",
      "tables/index.md",
      "tables/orders.md",
      "viz.html",
    ])
    expect(t.okfVersion).toBe("0.2")
    expect(t.concept("tables/orders")?.path).toBe("tables/orders.md")
    expect(t.concept("nope")).toBeUndefined()
  })

  it("normalizes input paths", () => {
    const t = tree({ "./a\\b.md": concept(), "../escape.md": concept() })
    expect(t.files).toEqual(["a/b.md"])
  })

  it("skips hidden directories and node_modules", () => {
    const t = tree({
      ".github/pull_request_template.md": "# PR\n",
      "node_modules/pkg/README.md": "# pkg\n",
      "docs/.drafts/x.md": "# draft\n",
      "a.md": concept(),
    })
    expect(t.concepts.map((c) => c.id)).toEqual(["a"])
    expect(t.ignored).toEqual([])
  })

  it("ignores root repository files case-insensitively, but only at the root", () => {
    const t = tree({
      "README.md": "# Repo\n",
      "license.md": "Apache\n",
      "CODE_OF_CONDUCT.md": "Be kind\n",
      "docs/README.md": concept(),
    })
    expect(t.ignored).toEqual(["CODE_OF_CONDUCT.md", "README.md", "license.md"])
    expect(t.concepts.map((c) => c.id)).toEqual(["docs/README"])
  })

  it("applies ignore globs from .okforest/tree.yaml", () => {
    const t = tree({
      ".okforest/tree.yaml": "ignore:\n  - FOLLOWUPS.md\n  - drafts/\n  - '**/*.wip.md'\n  - 42\n",
      "FOLLOWUPS.md": "# Roadmap\n",
      "drafts/a/b.md": "# draft\n",
      "x/y.wip.md": "# wip\n",
      "x/y.md": concept(),
    })
    expect(t.settings?.ignore).toEqual(["FOLLOWUPS.md", "drafts/", "**/*.wip.md"])
    expect(t.ignored).toEqual(["FOLLOWUPS.md", "drafts/a/b.md", "x/y.wip.md"])
    expect(t.concepts.map((c) => c.id)).toEqual(["x/y"])
  })

  it("reads settings and reports unreadable ones", () => {
    expect(
      tree({ ".okforest/tree.yaml": "tree: sales\nowner: user:jane@acme.example\n" }).settings,
    ).toMatchObject({
      path: ".okforest/tree.yaml",
      data: { tree: "sales", owner: "user:jane@acme.example" },
      ignore: [],
    })
    expect(tree({ ".okforest/tree.yaml": "" }).settings?.data).toEqual({})
    expect(tree({ ".okforest/tree.yaml": "owner: [\n" }).settings).toMatchObject({
      data: undefined,
      error: { message: expect.any(String), line: expect.any(Number) },
    })
    expect(tree({ ".okforest/tree.yaml": "- a\n" }).settings?.error?.message).toMatch(/mapping/)
    expect(tree({ "a.md": concept() }).settings).toBeUndefined()
  })

  it("leaves okfVersion unset when the root index declares none", () => {
    expect(tree({ "index.md": "# Root\n" }).okfVersion).toBeUndefined()
    expect(tree({ "index.md": "---\nokf_version: 0.2\n---\n" }).okfVersion).toBe(0.2)
  })
})

describe("links", () => {
  const t = tree({
    "tables/orders.md": concept(
      [
        "[abs](/metrics/revenue.md)",
        "[rel](../metrics/revenue.md#definition)",
        "[sibling](customers.md)",
        "[dir](../metrics/)",
        "[dir no slash](../metrics)",
        "[root](/)",
        "[anchor](#schema)",
        "[query only](?x=1)",
        "[web](https://acme.example/orders)",
        "[mail](mailto:jane@acme.example)",
        "[proto](//cdn.acme.example/x)",
        "[missing](/metrics/profit.md)",
        "[escape](../../outside.md)",
        "[encoded](../metrics/gross%20margin.md)",
        "[bad encoding](../metrics/%E0%A4%A.md)",
        "[script](/attesters/check.py)",
        "![img](chart.png)",
      ].join("\n\n"),
    ),
    "metrics/revenue.md": concept("[back](/tables/orders.md)"),
    "metrics/gross margin.md": concept(),
    "metrics/index.md": "# Metrics\n\n* [Revenue](revenue.md) - Revenue.\n",
    "attesters/check.py": undefined,
  })
  const links = t.concept("tables/orders")?.links ?? []
  const byText = (target: string) => links.find((l) => l.target === target)

  it("resolves absolute and relative links to concepts", () => {
    expect(byText("/metrics/revenue.md")).toMatchObject({
      kind: "internal",
      form: "absolute",
      resolved: "metrics/revenue.md",
      exists: true,
      concept: "metrics/revenue",
    })
    expect(byText("../metrics/revenue.md#definition")).toMatchObject({
      form: "relative",
      resolved: "metrics/revenue.md",
      concept: "metrics/revenue",
    })
  })

  it("marks missing, escaping, and directory targets", () => {
    expect(byText("customers.md")).toMatchObject({ resolved: "tables/customers.md", exists: false })
    expect(byText("/metrics/profit.md")).toMatchObject({ exists: false })
    expect(byText("/metrics/profit.md")?.concept).toBeUndefined()
    expect(byText("../../outside.md")).toMatchObject({ exists: false, outside: true })
    expect(byText("../metrics/")).toMatchObject({
      resolved: "metrics",
      exists: true,
      directory: true,
    })
    expect(byText("../metrics")).toMatchObject({ exists: true, directory: true })
    expect(byText("/")).toMatchObject({ resolved: "", exists: true, directory: true })
  })

  it("classifies anchors and external links", () => {
    expect(byText("#schema")?.kind).toBe("anchor")
    expect(byText("?x=1")?.kind).toBe("anchor")
    expect(byText("https://acme.example/orders")?.kind).toBe("external")
    expect(byText("mailto:jane@acme.example")?.kind).toBe("external")
    expect(byText("//cdn.acme.example/x")?.kind).toBe("external")
  })

  it("decodes percent-encoding, keeping malformed encodings as written", () => {
    expect(byText("../metrics/gross%20margin.md")).toMatchObject({
      exists: true,
      concept: "metrics/gross margin",
    })
    expect(byText("../metrics/%E0%A4%A.md")).toMatchObject({
      resolved: "metrics/%E0%A4%A.md",
      exists: false,
    })
  })

  it("checks links to non-markdown files and images", () => {
    expect(byText("/attesters/check.py")).toMatchObject({ exists: true })
    expect(byText("chart.png")).toMatchObject({ image: true, exists: false })
  })

  it("collects links from every file in path order, and backlinks from concepts only", () => {
    expect(t.links.map((l) => l.from)).toEqual([
      "metrics/index.md",
      "metrics/revenue.md",
      ...links.map(() => "tables/orders.md"),
    ])
    expect(t.backlinks("metrics/revenue").map((l) => l.from)).toEqual([
      "tables/orders.md",
      "tables/orders.md",
    ])
    expect(t.backlinks("tables/orders").map((l) => l.from)).toEqual(["metrics/revenue.md"])
    expect(t.backlinks("nothing")).toEqual([])
  })
})
