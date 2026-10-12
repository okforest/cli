import { globToRegExp } from "../src/index.js"
import { basename, dirname, isExternal, normalize } from "../src/paths.js"

describe("paths", () => {
  it("splits and normalizes bundle-relative paths", () => {
    expect(dirname("a/b/c.md")).toBe("a/b")
    expect(dirname("c.md")).toBe("")
    expect(basename("a/b/c.md")).toBe("c.md")
    expect(normalize("a/b", "../c/./d.md")).toBe("a/c/d.md")
    expect(normalize("/a//b/")).toBe("a/b")
    expect(normalize("a", "../../x")).toBeUndefined()
  })

  it("recognizes external destinations", () => {
    expect(isExternal("https://acme.example")).toBe(true)
    expect(isExternal("mailto:a@acme.example")).toBe(true)
    expect(isExternal("//cdn.acme.example")).toBe(true)
    expect(isExternal("/tables/orders.md")).toBe(false)
    expect(isExternal("orders.md")).toBe(false)
  })
})

describe("globToRegExp", () => {
  const matches = (glob: string, path: string) => globToRegExp(glob).test(path)

  it("matches within one segment with * and ?", () => {
    expect(matches("*.md", "FOLLOWUPS.md")).toBe(true)
    expect(matches("*.md", "docs/a.md")).toBe(false)
    expect(matches("note?.md", "note1.md")).toBe(true)
    expect(matches("note?.md", "note/.md")).toBe(false)
  })

  it("crosses segments with **", () => {
    expect(matches("**/*.wip.md", "a.wip.md")).toBe(true)
    expect(matches("**/*.wip.md", "a/b/c.wip.md")).toBe(true)
    expect(matches("drafts/**", "drafts/a/b.md")).toBe(true)
  })

  it("treats a trailing slash as a directory and a leading ./ or / as the root", () => {
    expect(matches("drafts/", "drafts/x.md")).toBe(true)
    expect(matches("./FOLLOWUPS.md", "FOLLOWUPS.md")).toBe(true)
    expect(matches("/FOLLOWUPS.md", "FOLLOWUPS.md")).toBe(true)
  })

  it("escapes regular-expression characters", () => {
    expect(matches("a+b (1).md", "a+b (1).md")).toBe(true)
    expect(matches("a.md", "aXmd")).toBe(false)
  })
})
