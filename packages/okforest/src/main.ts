import { initCommand } from "./commands/init.js"
import { inventoryCommand } from "./commands/inventory.js"
import { ruleCommand } from "./commands/rule.js"
import { typesCommand } from "./commands/types.js"
import { validateCommand } from "./commands/validate.js"
import { EXIT, type Io, UsageError, VERSION } from "./io.js"

export const HELP = `okforest ${VERSION}: validate, inventory, and scaffold Open Knowledge Format (OKF) v0.2 trees

Usage
  okforest validate [path] [--format text|json]
  okforest inventory [path] [--format text|json]
  okforest init [path] --template company [--name <name>]
  okforest rule [rule] [--format text|json]
  okforest types init [path] [--type <type>]... [--dry-run]

Commands
  validate    Check a tree against OKF v0.2 and OKForest conventions.
              Exits 1 when there are errors; warnings and info never fail.
  inventory   List every type, tag, and frontmatter key in use, with counts
              and likely near-duplicates.
  init        Create a new tree from a starter template (templates: company).
  rule        Explain a rule: why it exists, an example, and the fix.
              Without a rule, list every rule.
  types       Work with the tree's type schemas (.okforest/types/):
              \`types init\` drafts one for each type in use that has none.

Options
  -h, --help      Show help (also: okforest <command> --help)
  -v, --version   Show the version

Diagram syntax checks need the optional packages \`@d2lang/d2\` and \`mermaid\`
installed alongside okforest, e.g.:
  npx -p okforest -p @d2lang/d2 -p mermaid okforest validate .

Docs and source: https://github.com/okforest/cli
`

const COMMANDS = {
  validate: validateCommand,
  inventory: inventoryCommand,
  init: initCommand,
  rule: ruleCommand,
  types: typesCommand,
} as const

/** Run the CLI and return its exit code. */
export async function main(argv: readonly string[], io: Io): Promise<number> {
  const [command, ...rest] = argv
  try {
    if (command === undefined || command === "-h" || command === "--help" || command === "help") {
      io.stdout(HELP)
      return command === undefined ? EXIT.usage : EXIT.ok
    }
    if (command === "-v" || command === "--version") {
      io.stdout(`${VERSION}\n`)
      return EXIT.ok
    }
    if (!Object.hasOwn(COMMANDS, command)) {
      throw new UsageError(`Unknown command \`${command}\`. Run \`okforest --help\` for usage.`)
    }
    return await COMMANDS[command as keyof typeof COMMANDS](rest, io)
  } catch (error) {
    if (error instanceof UsageError || isArgsError(error)) {
      io.stderr(`okforest: ${(error as Error).message}\n`)
      return EXIT.usage
    }
    throw error
  }
}

function isArgsError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code
  return typeof code === "string" && code.startsWith("ERR_PARSE_ARGS_")
}
