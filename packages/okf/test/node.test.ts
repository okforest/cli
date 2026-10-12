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
    await write(".okforest/tree.yaml", "owner: user:jane@acme.example\n")
    await write(".git/HEAD", "ref: refs/heads/main\n")
    await write("node_modules/pkg/README.md", "# pkg\n")
    await symlink(join(root, "tables"), join(root, "linked"))
  })
  afterAll(() => rm(root, { recursive: true, force: true }))

  it("reads markdown and settings text, lists other files, and skips .git and node_modules", async () => {
    const files = await readTreeFiles(root)
    expect(files.map((f) => [f.path, f.text !== undefined])).toEqual([
      [".okforest/tree.yaml", true],
      ["attesters/check.py", false],
      ["index.md", true],
      ["tables/orders.md", true],
    ])
  })

  it("builds the tree", async () => {
    const tree = await readTree(root)
    expect(tree.okfVersion).toBe("0.2")
    expect(tree.settings?.data).toEqual({ owner: "user:jane@acme.example" })
    expect(tree.concept("tables/orders")?.links[0]).toMatchObject({ exists: true })
  })

  it("rejects a missing directory", async () => {
    await expect(readTree(join(root, "nope"))).rejects.toThrow(/ENOENT/)
  })
})
