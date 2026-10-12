import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

// @okforest/validate runs in Node, browsers, and Workers: no Node built-ins,
// and the diagram peers are reached only through dynamic import().
const src = join(import.meta.dirname, "..", "src")
const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter((f) =>
  f.endsWith(".ts"),
)

describe("package boundaries", () => {
  it.each(files)("%s imports no Node built-ins and no diagram packages statically", (file) => {
    const text = readFileSync(join(src, file), "utf8")
    const imports = [...text.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1])
    expect(
      imports.filter((i) => i?.startsWith("node:") || i === "mermaid" || i === "@d2lang/d2"),
    ).toEqual([])
  })
})
