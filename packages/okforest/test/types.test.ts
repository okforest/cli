import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { run } from "./helpers.js"

let work: string
beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), "okforest-types-"))
})
afterEach(() => rm(work, { recursive: true, force: true }))

const write = async (path: string, text: string) => {
  await mkdir(join(work, path, ".."), { recursive: true })
  await writeFile(join(work, path), text)
}

const customer = (name: string, fields: string) =>
  write(
    `customers/${name}.md`,
    `---\ntype: Customer\ntitle: ${name}\ndescription: A customer.\ntags: [customer]\n${fields}\n---\n\nNotes.\n`,
  )

/** Four customers, agreeing on some fields and not others. */
async function customers() {
  await write("index.md", '---\nokf_version: "0.2"\n---\n# Customers\n')
  await customer(
    "acme",
    "relationship: active\nsince: 2024-03-01\nowner: jane@acme.example\nseats: 12\nregions: [us, eu]\nnote: Our first customer.",
  )
  await customer(
    "globex",
    "relationship: active\nsince: 2025-01-15\nowner: raj@acme.example\nseats: 3\nregions: [eu]",
  )
  await customer(
    "initech",
    "relationship: former\nsince: 2023-07-01\nowner: kim@acme.example\nseats: 40\nwebsite: https://initech.example",
  )
  await customer(
    "umbrella",
    "relationship: former\nsince: 2022-11-30\nowner: jane@acme.example\nseats: 7.5\nnote: 42",
  )
  await write(
    "metrics/churn.md",
    "---\ntype: Metric\ntitle: Churn\ndescription: Customers lost.\nunit: percent\n---\n\nChurn.\n",
  )
}

const types = (...args: string[]) => run(["types", ...args], { cwd: work })

describe("okforest types init", () => {
  it("drafts a schema for each type that every concept of it matches", async () => {
    await customers()
    const result = await types("init", ".")
    expect(result).toMatchObject({ code: 0, stderr: "" })
    expect(result.stdout).toBe(
      "Drafted 2 type schemas in ..\n" +
        "  wrote    .okforest/types/customer.schema.json  (Customer, from 4)\n" +
        "  wrote    .okforest/types/metric.schema.json  (Metric, from 1)\n" +
        "\nNext: review each draft, then check the tree with `okforest validate .`.\n",
    )
    const schema = JSON.parse(
      await readFile(join(work, ".okforest/types/customer.schema.json"), "utf8"),
    )
    expect(schema).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $comment: expect.stringMatching(
        /^Drafted by okforest [\d.]+ types init from 4 concepts: tighten it/,
      ),
      title: "Customer",
      type: "object",
      properties: {
        // Mixed: free text and a number.
        note: { type: ["integer", "string"] },
        owner: { type: "string", format: "email" },
        regions: { type: "array", items: { type: "string" } },
        // Each value appears twice.
        relationship: { type: "string", enum: ["active", "former"] },
        // A decimal among whole numbers.
        seats: { type: "number" },
        since: { type: "string", format: "date" },
        website: { type: "string", format: "uri" },
      },
      required: ["owner", "relationship", "seats", "since"],
    })
    // One concept: nothing required, and no repeated values to allow.
    const metric = JSON.parse(
      await readFile(join(work, ".okforest/types/metric.schema.json"), "utf8"),
    )
    expect(metric).toMatchObject({ properties: { unit: { type: "string" } } })
    expect(metric).not.toHaveProperty("required")
    // Every concept matches its draft.
    expect((await run(["validate", ".", "--format", "json"], { cwd: work })).stdout).not.toContain(
      "okforest/type-schema",
    )
  })

  it("prints the drafts on a dry run, and writes nothing", async () => {
    await customers()
    const result = await types("init", ".", "--dry-run", "--type", "Metric")
    expect(result.code).toBe(0)
    expect(result.stdout).toMatch(
      /^Would draft 1 type schema in \.\.\n {2}\.okforest\/types\/metric\.schema\.json\n {4}\{\n/,
    )
    expect(result.stdout).toContain('      "title": "Metric",\n')
    expect(result.stdout).not.toContain("Next:")
    await expect(readdir(join(work, ".okforest"))).rejects.toThrow(/ENOENT/)
  })

  it("leaves types that have a schema, and never overwrites a file", async () => {
    await customers()
    await write(".okforest/types/customer.schema.json", '{ "title": "Client" }\n')
    await write(".okforest/types/other.schema.json", '{ "title": "Metric" }\n')
    const result = await types("init", ".")
    expect(result.stdout).toBe(
      "Drafted 0 type schemas in ..\n" +
        "  skipped  Customer: .okforest/types/customer.schema.json exists, for another type\n" +
        "  skipped  Metric: it has a schema already\n",
    )
    expect(await readFile(join(work, ".okforest/types/customer.schema.json"), "utf8")).toBe(
      '{ "title": "Client" }\n',
    )
  })

  it("rejects a type no concept has", async () => {
    await customers()
    const result = await types("init", ".", "--type", "Vendor")
    expect(result.code).toBe(2)
    expect(result.stderr).toContain("No concept has type `Vendor`")
  })
})

describe("okforest types", () => {
  it("lists its commands, and rejects others", async () => {
    expect(await types()).toMatchObject({ code: 2, stdout: expect.stringContaining("init") })
    expect(await types("--help")).toMatchObject({ code: 0 })
    expect((await types("init", "--help")).stdout).toContain("--dry-run")
    expect(await types("suggest")).toMatchObject({
      code: 2,
      stderr: expect.stringContaining("Unknown command `types suggest`"),
    })
  })
})
