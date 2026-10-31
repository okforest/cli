import { mkdir, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { type Concept, TYPES_FOLDER } from "@okforest/okf"
import { draftTypeSchema } from "@okforest/validate"
import { parseCommand } from "../args.js"
import { EXIT, type Io, UsageError, VERSION } from "../io.js"
import { loadTree } from "../tree.js"

const HELP = `Usage: okforest types <command> [path]

Work with the tree's type schemas: a JSON Schema for each type's frontmatter
in ${TYPES_FOLDER}, which \`okforest validate\` checks concepts against.

Commands
  init   Draft a schema for each type in use that has none.

Run \`okforest types <command> --help\` for its options.
`

const INIT_HELP = `Usage: okforest types init [path] [--type <type>]... [--dry-run]

Draft a JSON Schema for each type the tree at path (default: the current
directory) uses that has no schema yet, as ${TYPES_FOLDER}<type>.schema.json.
Each draft holds the fields the type's concepts use beyond OKF's, typed by
their values, with a format, allowed values, or required fields where every
concept agrees, so they all match it. Review and tighten each one; no file is
ever overwritten.

Options
  --type <type>   Only this type (repeatable), as concepts write it.
  --dry-run       Print the drafts instead of writing them.
`

const COMMANDS = { init: typesInit } as const

export async function typesCommand(args: readonly string[], io: Io): Promise<number> {
  const [command, ...rest] = args
  if (command === undefined || command === "-h" || command === "--help") {
    io.stdout(HELP)
    return command === undefined ? EXIT.usage : EXIT.ok
  }
  if (!Object.hasOwn(COMMANDS, command)) {
    throw new UsageError(
      `Unknown command \`types ${command}\`. Run \`okforest types --help\` for usage.`,
    )
  }
  return await COMMANDS[command as keyof typeof COMMANDS](rest, io)
}

async function typesInit(args: readonly string[], io: Io): Promise<number> {
  const { values, path } = parseCommand(args, {
    type: { type: "string", multiple: true },
    "dry-run": { type: "boolean" },
  })
  if (values.help) {
    io.stdout(INIT_HELP)
    return EXIT.ok
  }
  const tree = await loadTree(path, io)
  const byType = new Map<string, Concept[]>()
  for (const concept of tree.concepts) {
    if (concept.type === undefined) continue
    byType.set(concept.type, [...(byType.get(concept.type) ?? []), concept])
  }
  const wanted = values.type ?? [...byType.keys()].sort()
  const unknown = wanted.filter((type) => !byType.has(type))
  if (unknown.length > 0) {
    throw new UsageError(
      `No concept has type ${unknown.map((t) => `\`${t}\``).join(", ")}. Run \`okforest inventory ${path}\` to list the types in use.`,
    )
  }
  const schemas = new Set(tree.types.flatMap((schema) => (schema.name ? [schema.name] : [])))
  const files = new Set(tree.files)
  const lines: string[] = []
  let drafted = 0
  for (const type of wanted) {
    const concepts = byType.get(type) as Concept[]
    const file = `${TYPES_FOLDER}${slug(type)}.schema.json`
    if (schemas.has(type)) {
      lines.push(`  skipped  ${type}: it has a schema already`)
      continue
    }
    if (files.has(file)) {
      lines.push(`  skipped  ${type}: ${file} exists, for another type`)
      continue
    }
    const { $schema, ...draft } = draftTypeSchema(type, concepts)
    const schema = {
      $schema,
      $comment: `Drafted by okforest ${VERSION} types init from ${concepts.length} ${concepts.length === 1 ? "concept" : "concepts"}: tighten it (required fields, allowed values, formats).`,
      ...draft,
    }
    const text = `${JSON.stringify(schema, null, 2)}\n`
    drafted++
    if (values["dry-run"]) {
      lines.push(
        `  ${file}`,
        ...text
          .trimEnd()
          .split("\n")
          .map((line) => `    ${line}`),
      )
      continue
    }
    const target = resolve(io.cwd, path, file)
    await mkdir(join(target, ".."), { recursive: true })
    await writeFile(target, text, { flag: "wx" })
    lines.push(`  wrote    ${file}  (${type}, from ${concepts.length})`)
  }
  const verb = values["dry-run"] ? "Would draft" : "Drafted"
  io.stdout(
    `${verb} ${drafted} type ${drafted === 1 ? "schema" : "schemas"} in ${path}.\n` +
      (lines.length > 0 ? `${lines.join("\n")}\n` : "") +
      (drafted > 0 && !values["dry-run"]
        ? `\nNext: review each draft, then check the tree with \`okforest validate ${path}\`.\n`
        : ""),
  )
  return EXIT.ok
}

/** `BigQuery Table` → `bigquery-table`, `顧客` → `顧客`; `type` when no
 * letter or digit is left. */
function slug(type: string): string {
  return (
    type
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "type"
  )
}
