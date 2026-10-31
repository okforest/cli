import { concept, only } from "./helpers.js"

const RULE = "okforest/type-schema"
const SCHEMA = ".okforest/types/note.schema.json"

/** A tree with one Note concept and a schema for Notes. */
const check = (schema: object | string, extra = "") =>
  only(RULE, {
    [SCHEMA]: typeof schema === "string" ? schema : JSON.stringify(schema, null, 2),
    "note.md": concept(extra),
  })

describe("okforest/type-schema", () => {
  it("follows $refs within the schema: pointers, anchors, and the root", async () => {
    const schema = {
      title: "Note",
      $defs: { email: { $anchor: "email", type: "string", format: "email" } },
      properties: {
        owner: { $ref: "#/$defs/email" },
        reviewer: { $ref: "#email" },
        parts: { type: "array", items: { $ref: "#/properties/owner" } },
        related: { type: "array", prefixItems: [{ $ref: "#" }] },
        first: { $ref: "#/properties/related/prefixItems/0" },
      },
    }
    expect(await check(schema, "owner: jane@acme.example\nreviewer: raj@acme.example")).toEqual([])
    expect(await check(schema, "owner: jane\nreviewer: raj")).toEqual([
      "note.md:5:1 error okforest/type-schema `owner` must be an email address (got `jane`).",
      "note.md:6:1 error okforest/type-schema `reviewer` must be an email address (got `raj`).",
    ])
  })

  it("reports $refs that lead nowhere, or outside the schema", async () => {
    for (const [ref, message] of [
      ["#missing", "`$ref` `#missing` leads nowhere in this schema."],
      ["#/properties/x/1", "`$ref` `#/properties/x/1` leads nowhere in this schema."],
      [
        "person.schema.json",
        "`$ref` `person.schema.json` can't be followed: a type schema refers only within itself (`#/$defs/...`).",
      ],
    ]) {
      const schema = { title: "Note", properties: { x: [{ $ref: ref }] } }
      expect(await check(schema), ref).toEqual([
        `${SCHEMA}:6:9 error okforest/type-schema ${message}`,
      ])
    }
  })

  it("explains each kind of failure in the concept's words", async () => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Note",
      properties: {
        kind: { const: "memo" },
        size: { anyOf: [{ type: "integer" }, { type: "null" }] },
        owner: {
          type: "object",
          properties: { team: { type: ["string", "array"] } },
          required: ["email"],
        },
        secret: false,
        code: { type: "string", pattern: "^[A-Z]+$" },
      },
    }
    const extra = "kind: letter\nsize: big\nowner:\n  team: 3\nsecret: yes\ncode: abc"
    expect(await check(schema, extra)).toEqual([
      "note.md:5:1 error okforest/type-schema `kind` must be `memo` (got `letter`).",
      "note.md:6:1 error okforest/type-schema `size` doesn't match any of the forms the Note type allows (got `big`).",
      "note.md:7:1 error okforest/type-schema Missing `owner.email`, which the Note type requires.",
      "note.md:8:3 error okforest/type-schema `owner.team` must be a string or a list (got a number).",
      "note.md:9:1 error okforest/type-schema `secret` isn't allowed in the Note type.",
      "note.md:10:1 error okforest/type-schema `code` must match the pattern `^[A-Z]+$` (got `abc`).",
    ])
  })

  it("leaves OKF's fields out unless the schema names them", async () => {
    const closed = { title: "Note", additionalProperties: false }
    expect(await check(closed, "tags: [a]")).toEqual([])
    const named = { title: "Note", properties: { tags: { type: "array", minItems: 2 } } }
    expect(await check(named, "tags: [a]")).toEqual([
      "note.md:5:1 error okforest/type-schema `tags`: Array has too few items (1 < 2).",
    ])
  })

  it("says when a schema can't check a concept, on the concept", async () => {
    const schema = { title: "Note", properties: { code: { type: "string", pattern: "[" } } }
    const [finding] = await check(schema, "code: x")
    expect(finding).toMatch(
      new RegExp(
        `^note.md:2:1 error ${RULE} ${SCHEMA.replaceAll(".", "\\.")} can't check this concept: `,
      ),
    )
  })

  it("asks for a title that is text", async () => {
    expect(await check({ title: 3 })).toEqual([
      `${SCHEMA}:2:3 error ${RULE} A type schema needs a \`title\`: the type it's for, as concepts write it in \`type\`.`,
    ])
  })

  it("checks only concepts of a type that has a schema", async () => {
    const schema = { title: "Metric", required: ["unit"] }
    expect(await check(schema)).toEqual([])
    expect(
      await only(RULE, {
        [SCHEMA]: JSON.stringify({ title: "Note", required: ["owner"] }),
        "index.md": "# Notes\n",
        "untyped.md": "---\ntitle: No type\n---\n",
        "bare.md": "No frontmatter.\n",
      }),
    ).toEqual([])
  })
})
