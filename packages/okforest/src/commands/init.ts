import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { basename, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseCommand } from "../args.js"
import { EXIT, type Io, TEMPLATES_DIR, UsageError, VERSION } from "../io.js"

const HELP = `Usage: okforest init [path] --template <name> [--name <name>]

Create a new OKF v0.2 tree at path (default: the current directory, which must
be empty apart from .git) from a starter template. Starter concepts are drafts
for you to fill in.

Options
  --template <name>   Starter template (available: company).
  --name <name>       The bundle's name, up to 100 characters
                      (default: "<Folder> knowledge", without a -okf suffix).
`

export async function initCommand(args: readonly string[], io: Io): Promise<number> {
  const { values, path } = parseCommand(args, {
    template: { type: "string" },
    name: { type: "string" },
  })
  if (values.help) {
    io.stdout(HELP)
    return EXIT.ok
  }
  const templates = await listTemplates()
  const template = values.template
  if (typeof template !== "string" || !templates.includes(template)) {
    throw new UsageError(
      `${template === undefined ? "Choose" : `Unknown template \`${template}\`; choose`} a template with --template (${templates.join(", ")}).`,
    )
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
      : `${capitalize(slug(basename(target).replace(/-okf$/, "")) || "company")} knowledge`
  if (name === "" || [...name].length > 100) {
    throw new UsageError(
      `--name must be 1 to 100 characters (got ${[...name].length.toLocaleString("en-US")}).`,
    )
  }
  const now = new Date()
  const tokens: Record<string, string> = {
    name,
    // A JSON string is also a valid YAML double-quoted scalar.
    name_yaml: JSON.stringify(name),
    version: VERSION,
    date: now.toISOString().slice(0, 10),
    now: `${now.toISOString().slice(0, 19)}Z`,
  }

  const written = await copyTemplate(
    fileURLToPath(new URL(`${template}/`, TEMPLATES_DIR)),
    target,
    tokens,
  )
  const where = path
  const drafts = written.filter(
    (f) => f.endsWith(".md") && !/(^|\/)(index|log|README)\.md$/.test(f),
  )
  io.stdout(
    `Created a ${template} tree in ${where} (${written.length} files).\n\n` +
      "Next steps\n" +
      `  1. Review .okforest/settings.yaml (name: ${name}).\n` +
      `  2. Fill in the draft concepts: ${drafts.join(", ")}.\n` +
      `  3. Validate: npx okforest validate ${where}\n` +
      "  4. Commit and push; the included workflow validates every pull request.\n",
  )
  return EXIT.ok
}

async function listTemplates(): Promise<string[]> {
  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

/** Copy a template directory, replacing `{{token}}` for known tokens only
 * (GitHub Actions' `${{ ... }}` expressions are left alone). */
async function copyTemplate(
  from: string,
  to: string,
  tokens: Record<string, string>,
): Promise<string[]> {
  const written: string[] = []
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(join(from, dir), { withFileTypes: true })
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await walk(rel)
        continue
      }
      const text = (await readFile(join(from, rel), "utf8")).replace(
        /\{\{(\w+)\}\}/g,
        (match, key: string) => (Object.hasOwn(tokens, key) ? (tokens[key] as string) : match),
      )
      await mkdir(join(to, dir), { recursive: true })
      await writeFile(join(to, rel), text, { flag: "wx" })
      written.push(rel)
    }
  }
  await walk("")
  return written
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
