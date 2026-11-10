import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { run } from "./helpers.js"

let work: string
beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), "okforest-new-"))
})
afterEach(() => rm(work, { recursive: true, force: true }))

const write = async (path: string, text: string) => {
  await mkdir(join(work, path, ".."), { recursive: true })
  await writeFile(join(work, path), text)
}
const read = (path: string) => readFile(join(work, path), "utf8")

const TEMPLATE = `---
type: Metric
title:
status: draft
owner:      # who answers for it
tags: [metric]
---

<!-- What is counted, and over what period. -->

# Definition
`

/** A tree with a metrics folder, its index, and a Metric template. */
async function metrics() {
  await write(
    "index.md",
    '---\nokf_version: "0.2"\n---\n\n# Acme\n\n* [Metrics](metrics/index.md)\n',
  )
  await write("metrics/index.md", "# Metrics\n")
  await write(".okforest/types/metric.template.md", TEMPLATE)
}

describe("okforest new", () => {
  it("starts the page from its type's template, as written, and lists it", async () => {
    await metrics()
    const { code, stdout } = await run(
      [
        "new",
        "Metric",
        "metrics/churn.md",
        "--title",
        "Monthly churn",
        "--description",
        "Customers who cancel in a month.",
      ],
      { cwd: work },
    )
    expect(code).toBe(0)
    expect(await read("metrics/churn.md")).toBe(
      TEMPLATE.replace(
        "title:\n",
        "title: Monthly churn\ndescription: Customers who cancel in a month.\n",
      ),
    )
    expect(await read("metrics/index.md")).toBe(
      "# Metrics\n* [Monthly churn](churn.md) - Customers who cancel in a month.\n",
    )
    expect(stdout).toMatch(
      /^Created metrics\/churn\.md from \.okforest\/types\/metric\.template\.md, listed in metrics\/index\.md\.\n/,
    )
  })

  it("writes just the type, title, and description for a type without a template", async () => {
    await metrics()
    const { code, stdout } = await run(
      ["new", "Policy", "policies/refunds.md", "--title", "Refunds"],
      {
        cwd: work,
      },
    )
    expect(code).toBe(0)
    expect(await read("policies/refunds.md")).toBe("---\ntype: Policy\ntitle: Refunds\n---\n\n")
    expect(stdout).toContain(
      "Created policies/refunds.md (Policy has no template in .okforest/types/).",
    )
  })

  it("shows what's left to fill in on the new page", async () => {
    await metrics()
    await write(
      ".okforest/types/metric.schema.json",
      JSON.stringify({
        title: "Metric",
        type: "object",
        properties: { owner: { type: "string" } },
        required: ["owner"],
      }),
    )
    const { stdout } = await run(
      ["new", "Metric", "metrics/churn.md", "--title", "Monthly churn"],
      {
        cwd: work,
      },
    )
    expect(stdout).toContain("metrics/churn.md")
    expect(stdout).toContain("`owner` must be a string (got null).")
    expect(stdout).toContain("okforest/type-schema")
  })

  it("uses the tree at --root", async () => {
    await metrics()
    const { code } = await run(["new", "Metric", "metrics/arr.md", "--root", work], {
      cwd: tmpdir(),
    })
    expect(code).toBe(0)
    expect(await read("metrics/arr.md")).toBe(TEMPLATE)
    expect(await read("metrics/index.md")).toBe("# Metrics\n* [arr](arr.md)\n")
  })

  it("lists a page at the root in the root index, and shows that index's findings too", async () => {
    await write("index.md", "# Acme")
    const { stdout } = await run(["new", "Note", "faq.md", "--title", "FAQ [draft]"], { cwd: work })
    expect(await read("index.md")).toBe("# Acme\n* [FAQ \\[draft\\]](faq.md)\n")
    expect(stdout).toContain("listed in index.md")
    expect(stdout).toContain("okf/okf-version")
  })

  it("leaves a folder without an index alone", async () => {
    await write("index.md", '---\nokf_version: "0.2"\n---\n# Acme\n')
    await run(["new", "Note", "notes/a.md"], { cwd: work })
    expect(await read("notes/a.md")).toBe("---\ntype: Note\n---\n\n")
  })

  it.each([
    [["new"], "Give a type and a file"],
    [["new", "Metric"], "Give a type and a file"],
    [["new", "Metric", "a.md", "b.md"], "Give a type and a file"],
    [["new", " ", "a.md"], "The type can't be blank."],
    [["new", "Metric", "churn.txt"], "isn't a markdown file in the tree"],
    [["new", "Metric", "../churn.md"], "isn't a markdown file in the tree"],
    [["new", "Metric", "metrics/index.md"], "index.md is OKF's, not a concept"],
    [["new", "Metric", ".okforest/types/x.md"], "in a folder OKF leaves out of the tree"],
    [["new", "Metric", "metrics/index.md".replace("index", "existing")], "exists already"],
  ])("refuses %j", async (args, message) => {
    await metrics()
    await write("metrics/existing.md", "---\ntype: Metric\n---\n")
    const { code, stderr } = await run(args, { cwd: work })
    expect(code).toBe(2)
    expect(stderr).toContain(message)
  })

  it("explains itself", async () => {
    const { code, stdout } = await run(["new", "--help"])
    expect(code).toBe(0)
    expect(stdout).toContain("Usage: okforest new <type> <file>")
  })
})
