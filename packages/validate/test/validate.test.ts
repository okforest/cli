import { parseTree } from "@okforest/okf"
import { defaultRules, okforestRules, okfRules, type Rule, validate } from "../src/index.js"
import { concept, lines, validateFiles } from "./helpers.js"

const tree = parseTree([
  { path: "b.md", text: "---\ntitle: B\n---\n" },
  { path: "a.md", text: "---\ntype: Note\n---\n" },
])

describe("validate", () => {
  it("runs the default rules and summarizes", async () => {
    const result = await validate(tree)
    expect(result).toMatchObject({ concepts: 2, files: 2, ok: false, errors: 1, infos: 1 })
    expect(result.warnings).toBe(3)
    expect(defaultRules).toEqual([...okfRules, ...okforestRules])
  })

  it("sorts findings by file, line, column, rule, then message", async () => {
    const rule: Rule = {
      id: "test/order",
      severity: "warning",
      description: "Reports out of order.",
      check({ report }) {
        report({ file: "b.md", line: 2, message: "z" })
        report({ file: "a.md", line: 3, column: 2, message: "y" })
        report({ file: "a.md", line: 3, column: 1, message: "y" })
        report({ file: "a.md", message: "no position" })
        report({ file: "a.md", line: 3, column: 1, message: "x" })
      },
    }
    const result = await validate(tree, { rules: [rule] })
    expect(lines(result.findings)).toEqual([
      "a.md:-:- warning test/order no position",
      "a.md:3:1 warning test/order x",
      "a.md:3:1 warning test/order y",
      "a.md:3:2 warning test/order y",
      "b.md:2:- warning test/order z",
    ])
    expect(result.ok).toBe(true)
  })

  it("applies severity overrides and skips rules turned off", async () => {
    const result = await validate(tree, { severity: { "okf/type": "warning", "okf/title": "off" } })
    expect(result.findings.find((f) => f.ruleId === "okf/type")?.severity).toBe("warning")
    expect(result.findings.some((f) => f.ruleId === "okf/title")).toBe(false)
    expect(result.ok).toBe(true)
  })

  it("shares once() resources between rules and disposes them, even when a rule throws", async () => {
    const created = vi.fn(async () => ({ value: 42 }))
    const disposed = vi.fn()
    const user = (id: string): Rule => ({
      id,
      severity: "info",
      description: "Uses a shared resource.",
      async check({ once, report }) {
        const resource = await once("shared", created, disposed)
        report({ file: "a.md", message: `${resource.value}` })
      },
    })
    const failing: Rule = {
      id: "test/fails",
      severity: "error",
      description: "Throws.",
      check() {
        throw new Error("boom")
      },
    }
    await expect(
      validate(tree, { rules: [user("test/one"), user("test/two"), failing] }),
    ).rejects.toThrow("boom")
    expect(created).toHaveBeenCalledTimes(1)
    expect(disposed).toHaveBeenCalledWith({ value: 42 })
  })

  it("does not fail when a resource cannot be created or disposed", async () => {
    const rule: Rule = {
      id: "test/resources",
      severity: "info",
      description: "Creates resources.",
      async check({ once }) {
        await once(
          "bad-dispose",
          async () => 1,
          () => {
            throw new Error("dispose failed")
          },
        )
        await once("no-dispose", async () => 2)
        await once(
          "rejects",
          () => Promise.reject(new Error("nope")),
          () => undefined,
        ).catch(() => undefined)
      },
    }
    await expect(validate(tree, { rules: [rule] })).resolves.toMatchObject({ ok: true })
  })

  it("passes `now` to rules", async () => {
    const seen: Date[] = []
    const now = new Date("2030-01-01T00:00:00Z")
    await validateFiles(
      { "a.md": concept() },
      {
        now,
        rules: [
          { id: "t/now", severity: "info", description: "", check: (c) => void seen.push(c.now) },
        ],
      },
    )
    expect(seen).toEqual([now])
  })
})
