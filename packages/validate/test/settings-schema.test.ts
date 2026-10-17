import { readFileSync } from "node:fs"
import { parseTree } from "@okforest/okf"
import Ajv2020 from "ajv/dist/2020.js"
import { SETTINGS_KEYS } from "../src/index.js"
import { only } from "./helpers.js"

// schemas/settings.schema.json is what editors use (published at
// www.okforest.ai/schemas/settings.schema.json); the okforest/settings and
// okforest/settings-keys rules are what validation uses. They must agree:
// a file the schema accepts has no findings from either rule, and the other
// way round.
const schema = JSON.parse(
  readFileSync(new URL("../schemas/settings.schema.json", import.meta.url), "utf8"),
)
// markdownDescription is the hover text VS Code's YAML extension shows.
const ajv = new Ajv2020({ allErrors: true, strict: true })
ajv.addKeyword("markdownDescription")
const valid = ajv.compile(schema)

const CASES: [name: string, yaml: string][] = [
  ["empty", ""],
  [
    "every setting",
    "name: Sales knowledge\ndescription: Deals and pricing.\nignore: [README.md, drafts/]\n",
  ],
  ["empty list", "ignore: []\n"],
  ["name at the limit", `name: ${"n".repeat(100)}\n`],
  ["name over the limit", `name: ${"n".repeat(101)}\n`],
  ["name at the limit in emoji", `name: ${"🌲".repeat(100)}\n`],
  ["description at the limit", `description: ${"d".repeat(4000)}\n`],
  ["description over the limit", `description: ${"d".repeat(4001)}\n`],
  ["blank name", 'name: "  "\n'],
  ["name that isn't text", "name: 7\n"],
  ["description as a list", "description: [a]\n"],
  ["ignore not a list", "ignore: FOLLOWUPS.md\n"],
  ["blank ignore entry", 'ignore: [ok, ""]\n'],
  ["misspelled key", "nmae: Sales\n"],
  ["unknown key", "color: green\n"],
  ["not a mapping", "- name\n"],
]

describe("settings.schema.json", () => {
  it("names exactly the settings the rules know", () => {
    expect(Object.keys(schema.properties).sort()).toEqual([...SETTINGS_KEYS].sort())
  })

  it.each(CASES)("agrees with the rules: %s", async (_, yaml) => {
    const data = parseTree([{ path: ".okforest/settings.yaml", text: yaml }]).settings?.data
    const files = { ".okforest/settings.yaml": yaml }
    const findings = [
      ...(await only("okforest/settings", files)),
      ...(await only("okforest/settings-keys", files)),
    ]
    const accepted = data !== undefined && valid(data)
    expect({ accepted, ruleFindings: findings.length > 0 }).toEqual({
      accepted,
      ruleFindings: !accepted,
    })
  })
})
