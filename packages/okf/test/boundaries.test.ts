import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

// @okforest/okf runs in Node, browsers, and Workers: only src/node.ts may use
// Node built-ins, and the only runtime dependencies are the YAML and markdown
// parsers (no SDKs or frameworks).
const src = join(import.meta.dirname, "..", "src")
const imports = (file: string) =>
  [...readFileSync(join(src, file), "utf8").matchAll(/^import .* from "([^"]+)"/gm)].map(
    (m) => m[1],
  )

describe("package boundaries", () => {
  const files = readdirSync(src).filter((f) => f.endsWith(".ts"))

  it("keeps Node built-ins in node.ts", () => {
    for (const file of files.filter((f) => f !== "node.ts")) {
      expect({ file, node: imports(file).filter((i) => i?.startsWith("node:")) }).toEqual({
        file,
        node: [],
      })
    }
  })

  it("imports only the declared parsers", () => {
    const allowed = new Set([
      "yaml",
      "mdast",
      "mdast-util-from-markdown",
      "mdast-util-gfm-footnote",
      "micromark-extension-gfm-footnote",
    ])
    for (const file of files) {
      const external = imports(file).filter(
        (i) => i && !i.startsWith(".") && !i.startsWith("node:"),
      )
      expect({ file, external: external.filter((i) => !allowed.has(i as string)) }).toEqual({
        file,
        external: [],
      })
    }
  })
})
