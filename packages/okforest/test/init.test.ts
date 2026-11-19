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
  it("creates a repository with an empty tree in okf/ that validates with no problems", async () => {
    const result = await init("acme-knowledge")
    expect(result.code).toBe(0)
    expect(result.stdout).toMatch(
      /^Created a repository for Acme knowledge in acme-knowledge, with an empty tree in acme-knowledge\/okf\/ \(9 files\)\./,
    )
    expect(result.stdout).toContain("npx okforest validate acme-knowledge/okf\n")
    expect(result.stdout).toContain("https://github.com/okforest/template-company-knowledge")
    expect(await run(["validate", "acme-knowledge/okf"], { cwd: work })).toMatchObject({
      code: 0,
      stdout: "✔ No problems · 0 concepts in 2 files\n",
    })

    const read = (path: string) => readFile(join(work, "acme-knowledge", path), "utf8")
    expect(await read("okf/index.md")).toMatch(
      /^---\nokf_version: "0\.3"\n---\n\n# Acme knowledge\n/,
    )
    expect(await read("okf/log.md")).toMatch(/^# Log\n\n## \d{4}-\d\d-\d\d\n/)
    expect(await read("okf/.okforest/settings.yaml")).toContain('name: "Acme knowledge"\n')
    expect(await read("README.md")).toMatch(/^# Acme knowledge\n/)
    expect(await read("AGENTS.md")).toContain("Acme knowledge: an [OKF v0.2]")
    expect(await read(".gitignore")).toBe(".DS_Store\nnode_modules/\n")
    expect(await read(".github/dependabot.yaml")).toContain('package-ecosystem: "github-actions"')
    const ci = await read(".github/workflows/ci.yaml")
    expect(ci).toContain("betterleaks git .\n          --config .betterleaks.toml")
    expect(ci).toContain("uses: okforest/validate-action@v1\n        with:\n          path: okf\n")
    // The workflow's shell variables, kept as written.
    expect(ci).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell variable, not a placeholder
      'base="https://github.com/betterleaks/betterleaks/releases/download/v${BETTERLEAKS_VERSION}"',
    )
    expect(await read(".betterleaks.toml")).toContain('id = "prose-password"')
    for (const file of ["README.md", "AGENTS.md", ".github/workflows/ci.yaml"]) {
      expect(await read(file)).not.toMatch(/\{\{\w+\}\}/)
    }
  })

  it("accepts a name with YAML punctuation", async () => {
    const result = await init("t", "--name", 'Sales: "ops" #1')
    expect(result.code).toBe(0)
    const settings = await readFile(join(work, "t", "okf", ".okforest", "settings.yaml"), "utf8")
    expect(settings).toContain('name: "Sales: \\"ops\\" #1"\n')
    expect((await run(["validate", "t/okf"], { cwd: work })).code).toBe(0)
  })

  it("initializes the current directory, allowing an existing .git", async () => {
    const dir = join(work, "Product")
    await mkdir(join(dir, ".git"), { recursive: true })
    const result = await run(["init"], { cwd: dir })
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("with an empty tree in okf/ (9 files)")
    expect(result.stdout).toContain("npx okforest validate okf\n")
    expect(await readFile(join(dir, "okf", ".okforest", "settings.yaml"), "utf8")).toContain(
      'name: "Product knowledge"\n',
    )
  })

  it("falls back to a default name when the folder name has no letters", async () => {
    expect((await init("___")).code).toBe(0)
    expect(
      await readFile(join(work, "___", "okf", ".okforest", "settings.yaml"), "utf8"),
    ).toContain('name: "Company knowledge"\n')
  })

  it("requires a name of 1 to 100 characters", async () => {
    expect(await init("x", "--name", " ")).toMatchObject({
      code: 2,
      stderr: "okforest: --name must be 1 to 100 characters (got 0).\n",
    })
    expect(await init("x", "--name", "n".repeat(101))).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/got 101/),
    })
  })

  it("has no templates of its own", async () => {
    expect(await init("x", "--template", "company")).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/^okforest: Unknown option '--template'/),
    })
  })

  it("refuses a non-empty directory", async () => {
    const dir = join(work, "full")
    await mkdir(dir)
    for (const name of ["a", "b", "c", "d"]) await writeFile(join(dir, name), "")
    expect(await init("full")).toMatchObject({
      code: 2,
      stderr: "okforest: full is not empty (a, b, c, ...).\n",
    })
  })
})
