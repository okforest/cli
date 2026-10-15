import { parseTree } from "@okforest/okf"
import {
  type D2Module,
  type MermaidModule,
  okforestRules,
  okfRules,
  REPORT_SCHEMA_VERSION,
  ruleUrl,
  toReport,
  validate,
} from "../src/index.js"
import { concept, lines, NOW, validateFiles } from "./helpers.js"

const diagramFindings = (findings: Awaited<ReturnType<typeof validateFiles>>["findings"]) =>
  lines(findings.filter((f) => /okforest\/(d2|mermaid|diagram)/.test(f.ruleId)))

/** A fake D2.js whose compile fails the way D2.js does, on `bad`. */
function fakeD2() {
  const calls = { constructed: 0, compiled: [] as string[], disposed: 0 }
  const module: D2Module = {
    D2: class {
      constructor() {
        calls.constructed++
      }
      async compile(source: string) {
        calls.compiled.push(source)
        if (source.includes("bad")) {
          throw new Error(JSON.stringify([{ errmsg: "index:1:3: unexpected token" }]))
        }
        return {}
      }
      async dispose() {
        calls.disposed++
      }
    },
  }
  return { module, calls }
}

describe("diagram loaders", () => {
  const body = "```d2\nok\n```\n\n```d2\nx bad\n```"

  it("uses a custom D2 loader once per run and disposes its engine", async () => {
    const { module, calls } = fakeD2()
    const load = vi.fn(async () => module)
    const result = await validateFiles({ "a.md": concept("", body) }, { diagrams: { d2: load } })
    expect(diagramFindings(result.findings)).toEqual([
      "a.md:12:3 error okforest/d2-syntax D2 syntax error: unexpected token",
    ])
    expect(load).toHaveBeenCalledTimes(1)
    expect(calls).toEqual({ constructed: 1, compiled: ["ok", "x bad"], disposed: 1 })
  })

  it("never calls a loader when the tree has no diagrams of its language", async () => {
    const d2 = vi.fn(async () => fakeD2().module)
    await validateFiles(
      { "a.md": concept("", "```mermaid\ngraph TD\n  A --> B\n```") },
      { diagrams: { d2 } },
    )
    expect(d2).not.toHaveBeenCalled()
  })

  it("reports diagrams as not checked, with the loader's reason, when it is unavailable", async () => {
    const result = await validateFiles(
      { "a.md": concept("", body) },
      { diagrams: { d2: async () => ({ unavailable: "D2 could not be downloaded (offline)." }) } },
    )
    expect(diagramFindings(result.findings)).toEqual([
      "a.md:7:1 info okforest/diagram-unchecked D2 diagram not checked: D2 could not be downloaded (offline).",
      "a.md:11:1 info okforest/diagram-unchecked D2 diagram not checked: D2 could not be downloaded (offline).",
    ])
  })

  it("uses a custom Mermaid loader", async () => {
    const initialize = vi.fn()
    const module: MermaidModule = {
      default: {
        initialize,
        parse: async (source) => {
          if (source.includes("oops"))
            throw new Error("Parse error on line 2:\n...\nExpecting 'NODE', got 'EOF'")
          return {}
        },
      },
    }
    const result = await validateFiles(
      { "a.md": concept("", "```mermaid\ngraph TD\n  oops\n```") },
      { diagrams: { mermaid: async () => module } },
    )
    expect(diagramFindings(result.findings)).toEqual([
      "a.md:9:1 error okforest/mermaid-syntax Mermaid syntax error: Parse error on line 2: Expecting 'NODE', got 'EOF'",
    ])
    expect(initialize).toHaveBeenCalledWith({ startOnLoad: false, logLevel: "fatal" })
  })

  it("falls back to the default loader for a language given as undefined", async () => {
    const result = await validateFiles(
      { "a.md": concept("", "```d2\na -> {\n```") },
      { diagrams: { d2: undefined } },
    )
    expect(diagramFindings(result.findings)).toHaveLength(2)
    expect(result.findings.every((f) => f.ruleId !== "okforest/diagram-unchecked")).toBe(true)
  })
})

describe("toReport", () => {
  it("wraps a result as a versioned, self-describing document", async () => {
    const tree = parseTree([{ path: "a.md", text: "---\ntitle: A\n---\n" }])
    const result = await validate(tree, { now: NOW })
    const report = toReport(result, {
      tool: { name: "example-tool", version: "9.9.9" },
      path: "trees/a",
    })
    expect(report).toEqual({
      schemaVersion: REPORT_SCHEMA_VERSION,
      tool: { name: "example-tool", version: "9.9.9" },
      path: "trees/a",
      summary: { ok: false, errors: 1, warnings: 1, infos: 1, concepts: 1, files: 1 },
      findings: result.findings.map((f) => ({ ...f, docs: ruleUrl(f.ruleId) })),
    })
    expect(report.findings[0]?.docs).toMatch(/^https:\/\/www\.okforest\.ai\/docs\/rules\/okf\//)
    expect(REPORT_SCHEMA_VERSION).toBe(1)
  })
})

describe("ruleUrl", () => {
  // The site's rule pages (www.okforest.ai/docs/rules/<id>/) are generated
  // from this same rule list, so every rule has one at this address.
  it("gives every rule a page under /docs/rules/", () => {
    for (const rule of [...okfRules, ...okforestRules]) {
      expect(rule.id).toMatch(/^(okf|okforest)\/[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(ruleUrl(rule.id)).toBe(`https://www.okforest.ai/docs/rules/${rule.id}/`)
    }
  })
})
