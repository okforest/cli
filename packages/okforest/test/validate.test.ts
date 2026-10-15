import { chmod, mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { REPORT_SCHEMA_VERSION } from "@okforest/validate"
import { run } from "./helpers.js"

describe("okforest validate", () => {
  it("reports a clean tree and exits 0", async () => {
    expect(await run(["validate", "valid"])).toEqual({
      code: 0,
      stdout: "✔ No problems · 4 concepts in 8 files\n",
      stderr: "",
    })
  })

  it("defaults to the current directory", async () => {
    const result = await run(["validate"], {
      cwd: `${import.meta.dirname}/../../../fixtures/valid`,
    })
    expect(result.code).toBe(0)
  })

  it("groups findings by file and exits 1 on errors", async () => {
    const result = await run(["validate", "rules/okf/type"])
    expect(result.code).toBe(1)
    expect(result.stdout).toMatchSnapshot()
  })

  it("exits 0 when there are only warnings and info, and shows positionless findings", async () => {
    const result = await run(["validate", "rules/okforest/slug"])
    expect(result.code).toBe(0)
    expect(result.stdout).toMatchSnapshot()
  })

  it("writes a versioned JSON document", async () => {
    const result = await run(["validate", "rules/okf/status", "--format", "json"])
    expect(result.code).toBe(1)
    const document = JSON.parse(result.stdout)
    expect(document).toMatchObject({
      schemaVersion: REPORT_SCHEMA_VERSION,
      tool: { name: "okforest", version: expect.any(String) },
      path: "rules/okf/status",
      summary: { ok: false, errors: 2, warnings: 0, infos: 0, concepts: 2, files: 3 },
    })
    expect(document.findings[0]).toEqual({
      ruleId: "okf/status",
      severity: "error",
      file: "capitalized.md",
      line: 5,
      column: 1,
      message:
        "`status` must be `draft`, `stable`, or `deprecated` (use lowercase `draft`); got `Draft`.",
      docs: "https://www.okforest.ai/docs/rules/okf/status/",
    })
  })

  it("colors output when asked", async () => {
    const result = await run(["validate", "rules/okf/legacy-v01"], { color: true })
    expect(result.stdout).toContain("\u001b[")
    expect(result.stdout).toMatch(/✔.* 0 errors, 0 warnings, 2 info/)
  })

  it("explains paths it cannot read, with exit 2", async () => {
    expect(await run(["validate", "missing-dir"])).toEqual({
      code: 2,
      stdout: "",
      stderr: "okforest: No such directory: missing-dir\n",
    })
    expect(await run(["validate", "okf-samples/SOURCE.json"])).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/Not a directory/),
    })
    expect(await run(["validate", "valid", "--format", "xml"])).toMatchObject({ code: 2 })
  })

  // chmod 000 doesn't lock a directory for root, or at all on Windows.
  const cannotLock = process.getuid?.() === 0 || process.platform === "win32"
  it.skipIf(cannotLock)("reports an unreadable tree with exit 2", async () => {
    const dir = await mkdtemp(join(tmpdir(), "okforest-unreadable-"))
    await mkdir(join(dir, "locked"))
    await chmod(join(dir, "locked"), 0o000)
    try {
      expect(await run(["validate", dir])).toMatchObject({
        code: 2,
        stderr: expect.stringMatching(/^okforest: Could not read .*EACCES/),
      })
    } finally {
      await chmod(join(dir, "locked"), 0o755)
      await rm(dir, { recursive: true, force: true })
    }
  })
})
