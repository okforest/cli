import { readFileSync } from "node:fs"
import { parseTree } from "@okforest/okf"
import Ajv2020 from "ajv/dist/2020.js"
import { TREE_SETTINGS_KEYS } from "../src/index.js"
import { only } from "./helpers.js"

// schemas/tree.schema.json is what editors use (published at
// www.okforest.ai/schemas/tree.schema.json); the okforest/tree-yaml and
// okforest/tree-yaml-keys rules are what validation uses. They must agree:
// a file the schema accepts has no findings from either rule, and the other
// way round.
const schema = JSON.parse(
  readFileSync(new URL("../schemas/tree.schema.json", import.meta.url), "utf8"),
)
// markdownDescription is the hover text VS Code's YAML extension shows.
const ajv = new Ajv2020({ allErrors: true, strict: true })
ajv.addKeyword("markdownDescription")
const valid = ajv.compile(schema)

const CASES: [name: string, yaml: string][] = [
  ["minimal", "owner: user:jane@acme.example\n"],
  [
    "every setting",
    [
      "tree: sales",
      "title: Sales knowledge",
      "owner: user:jane@acme.example",
      "backup_owner: user:raj@acme.example",
      "stewards:",
      "  - group: sales-ops",
      "  - user: maria@acme.example",
      "sensitivity_default: internal",
      "standards: acme-standards@v3",
      "ignore: [FOLLOWUPS.md, drafts/]",
      "",
    ].join("\n"),
  ],
  ["empty lists", "owner: user:a\nstewards: []\nignore: []\n"],
  ["no owner", "tree: sales\n"],
  ["owner without user:", "owner: jane@acme.example\n"],
  ["group as owner", "owner: group:sales\n"],
  ["owner as a list", "owner: [user:a, user:b]\n"],
  ["stewards not a list", "owner: user:a\nstewards: sales-ops\n"],
  ["steward as a bare string", "owner: user:a\nstewards: [jane@acme.example]\n"],
  ["steward with two keys", "owner: user:a\nstewards:\n  - { user: a, group: b }\n"],
  ["steward with an unknown key", "owner: user:a\nstewards:\n  - { team: x }\n"],
  ["steward that isn't text", "owner: user:a\nstewards:\n  - { user: 3 }\n"],
  ["title that isn't text", "owner: user:a\ntitle: 7\n"],
  ["blank tree", 'owner: user:a\ntree: "  "\n'],
  ["ignore not a list", "owner: user:a\nignore: FOLLOWUPS.md\n"],
  ["blank ignore entry", 'owner: user:a\nignore: [ok, ""]\n'],
  ["misspelled key", "owner: user:a\nstewrds: []\n"],
  ["unknown key", "owner: user:a\ncolor: green\n"],
  ["not a mapping", "- owner\n"],
]

describe("tree.schema.json", () => {
  it("names exactly the settings the rules know", () => {
    expect(Object.keys(schema.properties).sort()).toEqual([...TREE_SETTINGS_KEYS].sort())
  })

  it.each(CASES)("agrees with the rules: %s", async (_, yaml) => {
    const data = parseTree([{ path: ".okforest/tree.yaml", text: yaml }]).settings?.data
    const files = { ".okforest/tree.yaml": yaml }
    const findings = [
      ...(await only("okforest/tree-yaml", files)),
      ...(await only("okforest/tree-yaml-keys", files)),
    ]
    const accepted = data !== undefined && valid(data)
    expect({ accepted, ruleFindings: findings.length > 0 }).toEqual({
      accepted,
      ruleFindings: !accepted,
    })
  })
})
