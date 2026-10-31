import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readTree, readTreeFiles } from "../src/node.js"

describe("readTree", () => {
  let root: string
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "okf-node-"))
    const write = async (path: string, text: string) => {
      await mkdir(join(root, path, ".."), { recursive: true })
      await writeFile(join(root, path), text)
    }
    await write("index.md", '---\nokf_version: "0.2"\n---\n# Root\n')
    await write("tables/orders.md", "---\ntype: Table\n---\n[x](../attesters/check.py)\n")
    await write("attesters/check.py", "print('ok')\n")
    await write(".okforest/settings.yaml", "name: Sales\nignore: [node_modules/]\n")
    await write(".okforest/types/table.schema.json", '{ "title": "Table" }\n')
    await write(".okforest/types/notes.txt", "Not a schema.\n")
    await write(".git/HEAD", "ref: refs/heads/main\n")
    await write(".github/pull_request_template.md", "# PR\n")
    await write("node_modules/pkg/README.md", "# pkg\n")
    await symlink(join(root, "tables"), join(root, "linked"))
  })
  afterAll(() => rm(root, { recursive: true, force: true }))

  it("reads settings, type schemas, and markdown text, lists other and ignored files, and skips .git", async () => {
    const files = await readTreeFiles(root)
    expect(files.map((f) => [f.path, f.text !== undefined])).toEqual([
      [".github/pull_request_template.md", true],
      [".okforest/settings.yaml", true],
      [".okforest/types/notes.txt", false],
      [".okforest/types/table.schema.json", true],
      ["attesters/check.py", false],
      ["index.md", true],
      ["node_modules/pkg/README.md", false],
      ["tables/orders.md", true],
    ])
  })

  it("reads every markdown file when there are no settings", async () => {
    expect(await readTreeFiles(join(root, "node_modules"))).toEqual([
      { path: "pkg/README.md", text: "# pkg\n" },
    ])
  })

  it("builds the tree", async () => {
    const tree = await readTree(root)
    expect(tree.okfVersion).toBe("0.2")
    expect(tree.settings).toMatchObject({ name: "Sales", ignore: ["node_modules/"] })
    expect(tree.ignored).toEqual(["node_modules/pkg/README.md"])
    expect(tree.types.map((t) => t.name)).toEqual(["Table"])
    expect(tree.concepts.map((c) => c.id)).toEqual([
      ".github/pull_request_template",
      "tables/orders",
    ])
    expect(tree.concept("tables/orders")?.links[0]).toMatchObject({ exists: true })
  })

  it("rejects a missing directory", async () => {
    await expect(readTree(join(root, "nope"))).rejects.toThrow(/ENOENT/)
  })
})
