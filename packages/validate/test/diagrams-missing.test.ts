import { concept, only } from "./helpers.js"

// Without the optional peers (the default for `npx okforest`), diagrams are
// reported as unchecked instead of failing validation.
// (vi.mock is hoisted above imports, so each factory is self-contained.)
vi.mock("@d2lang/d2", () => {
  throw Object.assign(new Error("Cannot find package"), { code: "ERR_MODULE_NOT_FOUND" })
})
vi.mock("mermaid", () => {
  throw Object.assign(new Error("Cannot find module"), { code: "MODULE_NOT_FOUND" })
})

describe("diagram rules without the optional peers", () => {
  it("reports each diagram as unchecked, with how to enable checking", async () => {
    const body = "```d2\na -> {\n```\n\n```mermaid\ngraph TD\n  A -->\n```"
    expect(await only("okforest/diagram-unchecked", { "a.md": concept("", body) })).toEqual([
      "a.md:7:1 info okforest/diagram-unchecked D2 diagram not checked: Install `@d2lang/d2` alongside okforest to check D2 syntax.",
      "a.md:11:1 info okforest/diagram-unchecked Mermaid diagram not checked: Install `mermaid` alongside okforest to check Mermaid syntax.",
    ])
    expect(await only("okforest/d2-syntax", { "a.md": concept("", body) })).toEqual([])
  })
})
