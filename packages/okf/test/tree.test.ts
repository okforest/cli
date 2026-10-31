import { outlineTree, parseTree } from "../src/index.js"

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

  it("skips only .okforest and .git folders", () => {
    const t = tree({
      ".okforest/notes.md": "# notes\n",
      ".git/info.md": "# git\n",
      "docs/.git/x.md": "# git\n",
      ".github/pull_request_template.md": "# PR\n",
      "node_modules/pkg/README.md": "# pkg\n",
      "README.md": "# Repo\n",
      "a.md": concept(),
    })
    expect(t.concepts.map((c) => c.id)).toEqual([
      ".github/pull_request_template",
      "README",
      "a",
      "node_modules/pkg/README",
    ])
    expect(t.ignored).toEqual([])
  })

  it("applies ignore globs from .okforest/settings.yaml", () => {
    const t = tree({
      ".okforest/settings.yaml":
        "ignore:\n  - FOLLOWUPS.md\n  - drafts/\n  - '**/*.wip.md'\n  - 42\n",
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
      tree({ ".okforest/settings.yaml": "name: Sales\ndescription: Deals and pricing.\n" })
        .settings,
    ).toMatchObject({
      path: ".okforest/settings.yaml",
      data: { name: "Sales", description: "Deals and pricing." },
      name: "Sales",
      description: "Deals and pricing.",
      ignore: [],
    })
    expect(
      tree({ ".okforest/settings.yaml": 'name: " "\ndescription: 3\n' }).settings,
    ).not.toHaveProperty("name")
    expect(tree({ ".okforest/settings.yaml": "" }).settings?.data).toEqual({})
    expect(tree({ ".okforest/settings.yaml": "name: [\n" }).settings).toMatchObject({
      data: undefined,
      error: { message: expect.any(String), line: expect.any(Number) },
    })
    expect(tree({ ".okforest/settings.yaml": "- a\n" }).settings?.error?.message).toMatch(/mapping/)
    expect(tree({ "a.md": concept() }).settings).toBeUndefined()
  })

  it("reads type schemas, locating their keys and where JSON breaks", () => {
    const t = tree({
      ".okforest/types/customer.schema.json": '{\n  "title": "Customer",\n  "type": "object"\n}\n',
      ".okforest/types/broken.schema.json": '{\n  "title": "Broken",\n}\n',
      ".okforest/types/untitled.schema.json": '{ "title": " " }',
      ".okforest/types/README.md": "# Types\n",
    })
    expect(t.types.map((s) => s.path)).toEqual([
      ".okforest/types/broken.schema.json",
      ".okforest/types/customer.schema.json",
      ".okforest/types/untitled.schema.json",
    ])
    const [broken, customer, untitled] = t.types
    expect(customer).toMatchObject({ name: "Customer", data: { title: "Customer" } })
    expect(customer?.locate(["type"])).toEqual({ line: 3, column: 3 })
    expect(broken).toMatchObject({ data: undefined, error: { line: 3, column: 1 } })
    expect(broken?.error?.message).toMatch(/^Not valid JSON: .+\.$/)
    expect(broken?.error?.message).not.toMatch(/position/)
    expect(untitled?.name).toBeUndefined()
    // Under .okforest/, so never a concept.
    expect(t.concepts).toEqual([])
    // An empty file breaks with no position: its start.
    expect(tree({ ".okforest/types/empty.schema.json": "" }).types[0]?.error).toMatchObject({
      message: expect.stringMatching(/^Not valid JSON: .+\.$/),
      line: 1,
      column: 1,
    })
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

describe("outlineTree", () => {
  const files = {
    ".okforest/settings.yaml": "name: Acme\nignore:\n  - drafts/\n",
    "index.md": '---\nokf_version: "0.2"\n---\n* [Orders](tables/orders.md) - orders\n',
    "tables/orders.md": concept("See [notes](../notes.md) and [the policy](/policy.md)."),
    "notes.md": concept("Back to [orders](tables/orders.md)."),
    "drafts/idea.md": concept(),
    ".git/HEAD.md": "ref",
    "logo.png": undefined,
  }

  it("outlines a tree from its paths and settings, without its markdown", () => {
    const outline = outlineTree(Object.keys(files), files[".okforest/settings.yaml"])
    expect(outline.files).toEqual(Object.keys(files).sort())
    expect(outline.markdown).toEqual(["index.md", "notes.md", "tables/orders.md"])
    expect(outline.ignored).toEqual(["drafts/idea.md"])
    expect(outline.settings?.name).toBe("Acme")
  })

  it("reads each file as parseTree does, one at a time", () => {
    const whole = tree(files)
    const outline = outlineTree(Object.keys(files), files[".okforest/settings.yaml"])
    const read = outline.markdown.map((path) =>
      outline.read(path, files[path as keyof typeof files] ?? ""),
    )
    const comparable = (file: object) =>
      JSON.parse(
        JSON.stringify(file, (_key, value) => (typeof value === "function" ? "fn" : value)),
      )
    expect(read.map(comparable)).toEqual(
      [...whole.concepts, ...whole.reserved]
        .sort((a, b) => (a.path < b.path ? -1 : 1))
        .map(comparable),
    )
    // Links resolve against the whole tree, though nothing else was read.
    const orders = read.find((file) => file.path === "tables/orders.md")
    expect(orders?.links.map((link) => [link.target, link.exists, link.concept])).toEqual([
      ["../notes.md", true, "notes"],
      ["/policy.md", false, undefined],
    ])
  })

  it("reads the type schemas whose text it's given, and only those", () => {
    const customer = '{ "title": "Customer", "type": "object" }\n'
    const outline = outlineTree(
      [...Object.keys(files), ".okforest/types/customer.schema.json", ".okforest/types/notes.json"],
      files[".okforest/settings.yaml"],
      new Map([
        [".okforest/types/customer.schema.json", customer],
        [".okforest/types/notes.json", "{}"],
      ]),
    )
    expect(outline.types.map((t) => [t.path, t.name, t.data])).toEqual([
      [".okforest/types/customer.schema.json", "Customer", { title: "Customer", type: "object" }],
    ])
    expect(outlineTree(Object.keys(files)).types).toEqual([])
  })

  it("refuses to read a file that isn't one of the tree's markdown files", () => {
    const outline = outlineTree(Object.keys(files), files[".okforest/settings.yaml"])
    for (const path of ["drafts/idea.md", "logo.png", "missing.md"]) {
      expect(() => outline.read(path, "# x\n"), path).toThrow(
        "not one of the tree's markdown files",
      )
    }
  })
})
