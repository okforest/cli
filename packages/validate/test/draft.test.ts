import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseTree } from "@okforest/okf"
import { readTreeFiles } from "@okforest/okf/node"
import { draftTypeSchema, validate } from "../src/index.js"
import { FIXTURES, NOW } from "./helpers.js"

const samples = JSON.parse(readFileSync(join(FIXTURES, "okf-samples", "SOURCE.json"), "utf8")) as {
  bundles: string[]
}

describe("draftTypeSchema", () => {
  it.each([...samples.bundles.map((bundle) => join("okf-samples", bundle)), "valid"])(
    "drafts schemas every concept matches: %s",
    async (dir) => {
      const files = await readTreeFiles(join(FIXTURES, dir))
      const tree = parseTree(files)
      const named = new Set(tree.types.map((schema) => schema.name))
      const types = [...new Set(tree.concepts.flatMap((c) => (c.type ? [c.type] : [])))]
      const drafts = types
        .filter((type) => !named.has(type))
        .map((type, i) => ({
          path: `.okforest/types/draft-${i}.schema.json`,
          text: JSON.stringify(
            draftTypeSchema(
              type,
              tree.concepts.filter((c) => c.type === type),
            ),
          ),
        }))
      expect(drafts.length).toBeGreaterThan(0)
      const result = await validate(parseTree([...files, ...drafts]), { now: NOW })
      expect(result.findings.filter((f) => f.ruleId === "okforest/type-schema")).toEqual([])
    },
  )

  it("types what it can't narrow, and leaves out OKF's fields and nulls", () => {
    const concepts = [
      {
        frontmatter: {
          type: "T",
          title: "A",
          tags: ["x"],
          items: [1, 2],
          meta: { a: 1 },
          gone: null,
        },
      },
      { frontmatter: { type: "T", title: "B", items: [3], meta: { b: 2 }, flag: true } },
    ]
    expect(draftTypeSchema("T", concepts)).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "T",
      type: "object",
      properties: {
        flag: { type: "boolean" },
        items: { type: "array" },
        meta: { type: "object" },
      },
      required: ["items", "meta"],
    })
  })

  it("narrows strings to a format or a few repeated values, and numbers to their kind", () => {
    const rows = [
      { stage: "open", since: "2024-03-01", at: "2024-03-01T09:00:00Z", owner: "a@acme.example" },
      { stage: "open", since: "2025-01-15", at: "2025-01-15T10:30:00Z", owner: "b@acme.example" },
      { stage: "won", since: "2023-07-01", at: "2023-07-01T08:00:00Z", owner: "c@acme.example" },
      { stage: "won", since: "2022-11-30", at: "2022-11-30T17:45:00Z", owner: "d@acme.example" },
    ]
    const more = [
      { site: "https://a.example", seats: 3, score: 1, labels: ["x"], note: "First." },
      { site: "https://b.example", seats: 4.5, score: 2, labels: ["y", "z"], note: 7 },
      { site: "https://c.example", seats: 5, score: 3, labels: ["x"], note: "Third." },
      { site: "https://d.example", seats: 6, score: 4, labels: [], note: "Fourth." },
    ]
    const concepts = rows.map((row, i) => ({ frontmatter: { type: "T", ...row, ...more[i] } }))
    expect(draftTypeSchema("T", concepts).properties).toEqual({
      at: { type: "string", format: "date-time" },
      labels: { type: "array", items: { type: "string" } },
      note: { type: ["integer", "string"] },
      owner: { type: "string", format: "email" },
      score: { type: "integer" },
      seats: { type: "number" },
      since: { type: "string", format: "date" },
      site: { type: "string", format: "uri" },
      stage: { type: "string", enum: ["open", "won"] },
    })
    // A value used once, or one too long, makes no list of allowed values.
    const once = draftTypeSchema("T", [
      { frontmatter: { type: "T", stage: "open" } },
      { frontmatter: { type: "T", stage: "open" } },
      { frontmatter: { type: "T", stage: "won" } },
    ])
    expect(once.properties).toEqual({ stage: { type: "string" } })
    const long = "a".repeat(41)
    const tooLong = draftTypeSchema("T", [
      { frontmatter: { type: "T", stage: long } },
      { frontmatter: { type: "T", stage: long } },
    ])
    expect(tooLong.properties).toEqual({ stage: { type: "string" } })
    // A concept whose frontmatter couldn't be read adds nothing.
    expect(draftTypeSchema("T", [{ frontmatter: undefined }]).properties).toEqual({})
  })
})
