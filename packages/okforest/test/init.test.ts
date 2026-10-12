import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { run } from "./helpers.js"

let work: string
const saved = { ...process.env }
beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), "okforest-init-"))
  // Isolate from this machine's git identity.
  process.env.GIT_CONFIG_GLOBAL = join(work, "no-gitconfig")
  process.env.GIT_CONFIG_NOSYSTEM = "1"
})
afterEach(async () => {
  process.env = { ...saved }
  await rm(work, { recursive: true, force: true })
})

const init = (...args: string[]) => run(["init", ...args], { cwd: work })

describe("okforest init", () => {
  it("creates a company tree that validates with no findings", async () => {
    const result = await init("acme-okf", "--template", "company", "--owner", "jane@acme.example")
    expect(result.code).toBe(0)
    expect(result.stdout).toMatch(/^Created a company tree in acme-okf \(9 files\)\./)
    expect(result.stdout).toContain("company/overview.md, customers/ideal-customer-profile.md")
    expect(await run(["validate", "acme-okf"], { cwd: work })).toMatchObject({
      code: 0,
      stdout: "✔ No problems · 2 concepts in 6 files\n",
    })

    const settings = await readFile(join(work, "acme-okf", ".okforest", "tree.yaml"), "utf8")
    expect(settings).toContain(
      'tree: acme\ntitle: "Acme knowledge"\nowner: user:jane@acme.example ',
    )
    const overview = await readFile(join(work, "acme-okf", "company", "overview.md"), "utf8")
    expect(overview).toMatch(
      /generated: \{ by: okforest\/[\d.]+, at: \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ \}/,
    )
    const workflow = await readFile(
      join(work, "acme-okf", ".github", "workflows", "okforest-validate.yml"),
      "utf8",
    )
    expect(workflow).toMatch(/npx --yes okforest@\^[\d.]+ validate \./)
    expect(workflow).not.toMatch(/\{\{\w+\}\}/)
  })

  it("accepts a user: prefix, a custom tree name, and a title with YAML punctuation", async () => {
    const result = await init(
      "t",
      "--template",
      "company",
      "--owner",
      "user:raj@acme.example",
      "--tree",
      "Sales Ops",
      "--title",
      'Sales: "ops" #1',
    )
    expect(result.code).toBe(0)
    const settings = await readFile(join(work, "t", ".okforest", "tree.yaml"), "utf8")
    expect(settings).toContain(
      'tree: sales-ops\ntitle: "Sales: \\"ops\\" #1"\nowner: user:raj@acme.example ',
    )
    expect((await run(["validate", "t"], { cwd: work })).code).toBe(0)
  })

  it("initializes the current directory, allowing an existing .git", async () => {
    const dir = join(work, "Product")
    await mkdir(join(dir, ".git"), { recursive: true })
    const result = await run(["init", "--template", "company", "--owner", "a@acme.example"], {
      cwd: dir,
    })
    expect(result.code).toBe(0)
    expect(await readFile(join(dir, ".okforest", "tree.yaml"), "utf8")).toContain(
      'tree: product\ntitle: "Product knowledge"',
    )
  })

  it("falls back to a default tree name when the folder name has no letters", async () => {
    expect((await init("___", "--template", "company", "--owner", "a@acme.example")).code).toBe(0)
    expect(await readFile(join(work, "___", ".okforest", "tree.yaml"), "utf8")).toContain(
      "tree: company\n",
    )
  })

  it("takes the Owner from git config user.email", async () => {
    const dir = join(work, "repo")
    await mkdir(dir)
    spawnSync("git", ["init", "-q"], { cwd: dir })
    spawnSync("git", ["config", "user.email", "maria@acme.example"], { cwd: dir })
    expect((await init("repo", "--template", "company")).code).toBe(0)
    expect(await readFile(join(dir, ".okforest", "tree.yaml"), "utf8")).toContain(
      "owner: user:maria@acme.example",
    )
  })

  it("requires an Owner when git has none", async () => {
    expect(await init("x", "--template", "company")).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/--owner <email>/),
    })
    expect(await init("x", "--template", "company", "--owner", "Jane Smith")).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/no spaces/),
    })
  })

  it("requires a known template", async () => {
    expect(await init("x", "--owner", "a")).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/Choose a template .*\(company\)/),
    })
    expect(await init("x", "--template", "hr", "--owner", "a")).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/Unknown template `hr`/),
    })
  })

  it("refuses a non-empty directory", async () => {
    const dir = join(work, "full")
    await mkdir(dir)
    for (const name of ["a", "b", "c", "d"]) await writeFile(join(dir, name), "")
    expect(await init("full", "--template", "company", "--owner", "a")).toMatchObject({
      code: 2,
      stderr: "okforest: full is not empty (a, b, c, ...).\n",
    })
  })
})
