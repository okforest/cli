import { mkdir, readdir, writeFile } from "node:fs/promises"
import { basename, dirname, join, resolve } from "node:path"
import { parseCommand } from "../args.js"
import { EXIT, type Io, UsageError } from "../io.js"
import { BUNDLE, starterFiles } from "../starter.js"

/** The template repository a company tree starts from. */
export const COMPANY_TEMPLATE = "okforest/template-company-knowledge"

const HELP = `Usage: okforest init [path] [--name <name>]

Create a repository for an OKF 0.3 tree at path (default: the current
directory, which must be empty apart from .git): an empty bundle in ${BUNDLE}/
(its index.md, log.md, and .okforest/settings.yaml), with a README.md, an
AGENTS.md for AI agents, a .gitignore, and GitHub workflows that scan for
secrets and validate every pull request. For a company's tree, with its
folders, types, and starter concepts, start from the template repository
instead: https://github.com/${COMPANY_TEMPLATE}

Options
  --name <name>       The bundle's name, up to 100 characters (default:
                      "<Folder> knowledge", without an -okf or -knowledge
                      suffix).
`

export async function initCommand(args: readonly string[], io: Io): Promise<number> {
  const { values, path } = parseCommand(args, {
    name: { type: "string" },
  })
  if (values.help) {
    io.stdout(HELP)
    return EXIT.ok
  }

  const target = resolve(io.cwd, path)
  const existing = await readdir(target).catch(() => [] as string[])
  const blocking = existing.filter((name) => name !== ".git" && name !== ".DS_Store")
  if (blocking.length > 0) {
    throw new UsageError(
      `${path} is not empty (${blocking.slice(0, 3).join(", ")}${blocking.length > 3 ? ", ..." : ""}).`,
    )
  }

  const name =
    typeof values.name === "string"
      ? values.name.trim()
      : `${capitalize(slug(basename(target).replace(/-(okf|knowledge)$/, "")) || "company")} knowledge`
  if (name === "" || [...name].length > 100) {
    throw new UsageError(
      `--name must be 1 to 100 characters (got ${[...name].length.toLocaleString("en-US")}).`,
    )
  }

  const files = starterFiles(name, new Date().toISOString().slice(0, 10))
  for (const [rel, text] of Object.entries(files)) {
    await mkdir(dirname(join(target, rel)), { recursive: true })
    await writeFile(join(target, rel), text, { flag: "wx" })
  }
  const bundle = path === "." ? BUNDLE : `${path}/${BUNDLE}`
  io.stdout(
    `Created a repository for ${name} in ${path}, with an empty tree in ${bundle}/ (${Object.keys(files).length} files).\n\n` +
      "Next steps\n" +
      "  1. Read README.md's setup checklist, and make AGENTS.md yours.\n" +
      `  2. Add concepts: npx okforest new <Type> <folder>/<name>.md --root ${bundle}\n` +
      `  3. Validate: npx okforest validate ${bundle}\n` +
      "  4. Commit and push; the included workflow scans and validates every pull request.\n\n" +
      "For a company's tree, with its folders, types, and starter concepts, start from\n" +
      `https://github.com/${COMPANY_TEMPLATE} instead.\n`,
  )
  return EXIT.ok
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("-", " ")
}
