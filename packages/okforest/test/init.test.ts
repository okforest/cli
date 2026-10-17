import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { run } from "./helpers.js"

let work: string
beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), "okforest-init-"))
})
afterEach(() => rm(work, { recursive: true, force: true }))

const init = (...args: string[]) => run(["init", ...args], { cwd: work })

describe("okforest init", () => {
  it("creates a company tree that validates with no findings", async () => {
    const result = await init("acme-okf", "--template", "company")
    expect(result.code).toBe(0)
    expect(result.stdout).toMatch(/^Created a company tree in acme-okf \(9 files\)\./)
    expect(result.stdout).toContain("company/overview.md, customers/ideal-customer-profile.md")
    expect(await run(["validate", "acme-okf"], { cwd: work })).toMatchObject({
      code: 0,
      stdout: "✔ No problems · 2 concepts in 6 files\n",
    })

    const settings = await readFile(join(work, "acme-okf", ".okforest", "settings.yaml"), "utf8")
    expect(settings).toContain('name: "Acme knowledge"\n')
    expect(settings).toContain("ignore:\n  - README.md\n")
    const overview = await readFile(join(work, "acme-okf", "company", "overview.md"), "utf8")
    expect(overview).toMatch(
      /generated: \{ by: okforest\/[\d.]+, at: \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ \}/,
    )
    const workflow = await readFile(
      join(work, "acme-okf", ".github", "workflows", "okforest-validate.yml"),
      "utf8",
    )
    expect(workflow).toContain("uses: okforest/validate-action@v1")
    expect(workflow).not.toMatch(/\{\{\w+\}\}/)
  })

  it("accepts a name with YAML punctuation", async () => {
    const result = await init("t", "--template", "company", "--name", 'Sales: "ops" #1')
    expect(result.code).toBe(0)
    const settings = await readFile(join(work, "t", ".okforest", "settings.yaml"), "utf8")
    expect(settings).toContain('name: "Sales: \\"ops\\" #1"\n')
    expect((await run(["validate", "t"], { cwd: work })).code).toBe(0)
  })

  it("initializes the current directory, allowing an existing .git", async () => {
    const dir = join(work, "Product")
    await mkdir(join(dir, ".git"), { recursive: true })
    const result = await run(["init", "--template", "company"], { cwd: dir })
    expect(result.code).toBe(0)
    expect(await readFile(join(dir, ".okforest", "settings.yaml"), "utf8")).toContain(
      'name: "Product knowledge"\n',
    )
  })

  it("falls back to a default name when the folder name has no letters", async () => {
    expect((await init("___", "--template", "company")).code).toBe(0)
    expect(await readFile(join(work, "___", ".okforest", "settings.yaml"), "utf8")).toContain(
      'name: "Company knowledge"\n',
    )
  })

  it("requires a name of 1 to 100 characters", async () => {
    expect(await init("x", "--template", "company", "--name", " ")).toMatchObject({
      code: 2,
      stderr: "okforest: --name must be 1 to 100 characters (got 0).\n",
    })
    expect(await init("x", "--template", "company", "--name", "n".repeat(101))).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/got 101/),
    })
  })

  it("requires a known template", async () => {
    expect(await init("x")).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/Choose a template .*\(company\)/),
    })
    expect(await init("x", "--template", "hr")).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/Unknown template `hr`/),
    })
  })

  it("refuses a non-empty directory", async () => {
    const dir = join(work, "full")
    await mkdir(dir)
    for (const name of ["a", "b", "c", "d"]) await writeFile(join(dir, name), "")
    expect(await init("full", "--template", "company")).toMatchObject({
      code: 2,
      stderr: "okforest: full is not empty (a, b, c, ...).\n",
    })
  })
})
