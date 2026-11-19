import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, posix, resolve } from "node:path"
import { parseArgs } from "node:util"
import { startPage, TYPES_FOLDER } from "@okforest/okf"
import { type ValidationResult, validate } from "@okforest/validate"
import { EXIT, type Io, UsageError } from "../io.js"
import { loadTree } from "../tree.js"
import { toText } from "./validate.js"

const HELP = `Usage: okforest new <type> <file> [--title <title>] [--description <text>] [--root <path>]

Create a concept of type <type> at <file> (a path in the tree, ending in .md)
from the type's template, ${TYPES_FOLDER}<type>.template.md, as written: its
front matter in its order, its body, and its guidance. The title and
description given replace the template's. A type without a template starts
with just its type, title, and description. When the file's folder has an
index.md, the new concept is listed in it; a folder it creates gets an
index.md listing the page, and is listed in its parent's. Then the new page
is checked, so what's left to fill in shows at once.

Options
  --title <title>        The concept's title.
  --description <text>   Its one-sentence description.
  --root <path>          The tree's root folder (default: the current directory).
`

export async function newCommand(args: readonly string[], io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      title: { type: "string" },
      description: { type: "string" },
      root: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  })
  if (values.help) {
    io.stdout(HELP)
    return EXIT.ok
  }
  const [type, file, ...extra] = positionals
  if (type === undefined || file === undefined || extra.length > 0) {
    throw new UsageError(
      "Give a type and a file: `okforest new <type> <file>`, e.g. `okforest new Metric metrics/churn.md`.",
    )
  }
  if (type.trim() === "") throw new UsageError("The type can't be blank.")
  const root = values.root ?? "."
  const path = posix.normalize(file.replaceAll("\\", "/")).replace(/^\.\//, "")
  if (!path.endsWith(".md") || path.startsWith("../") || posix.isAbsolute(path)) {
    throw new UsageError(`${file} isn't a markdown file in the tree: give a path ending in .md.`)
  }
  const name = posix.basename(path)
  if (name === "index.md" || name === "log.md") {
    throw new UsageError(`${name} is OKF's, not a concept: give another name.`)
  }
  if (path.split("/").some((segment) => segment === ".okforest" || segment === ".git")) {
    throw new UsageError(`${file} is in a folder OKF leaves out of the tree.`)
  }

  const tree = await loadTree(root, io)
  const target = resolve(io.cwd, root, path)
  if (await exists(target)) throw new UsageError(`${path} exists already.`)
  const template = tree.templates.find((t) => t.name === type && t.frontmatter)
  const text = startPage(
    {
      type,
      ...(values.title !== undefined && { title: values.title }),
      ...(values.description !== undefined && { description: values.description }),
    },
    template,
  )
  // The folders this page creates, outermost first.
  const created: string[] = []
  for (let folder = posix.dirname(path); folder !== "."; folder = posix.dirname(folder)) {
    if (!(await exists(resolve(io.cwd, root, folder)))) created.unshift(folder)
  }
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, text, { flag: "wx" })

  // Each folder it created gets an index.md listing what's in it, and the
  // outermost is listed in its parent's index.md, when that has one.
  const label = (values.title ?? name.slice(0, -".md".length)).replace(/[[\]]/g, "\\$&")
  let entry = `* [${label}](${name})${values.description ? ` - ${values.description}` : ""}`
  const written: string[] = []
  for (const folder of created.toReversed()) {
    const heading = folderTitle(posix.basename(folder))
    const index = `${folder}/index.md`
    await writeFile(resolve(io.cwd, root, index), `# ${heading}\n\n${entry}\n`, { flag: "wx" })
    written.push(index)
    entry = `* [${heading}](${posix.basename(folder)}/index.md)`
  }
  const parent = posix.dirname(created[0] ?? path)
  const index = parent === "." ? "index.md" : `${parent}/index.md`
  const listed = tree.files.includes(index)
  if (listed) {
    const indexFile = resolve(io.cwd, root, index)
    const before = await readFile(indexFile, "utf8")
    await writeFile(
      indexFile,
      `${before}${before === "" || before.endsWith("\n") ? "" : "\n"}${entry}\n`,
    )
    written.push(index)
  }

  io.stdout(
    `Created ${path} ${template ? `from ${template.path}` : `(${type} has no template in ${TYPES_FOLDER})`}` +
      `${created.length > 0 ? `, with ${written.slice(0, created.length).toReversed().join(" and ")}` : ""}` +
      `${listed ? `, listed in ${index}` : ""}.\n\n`,
  )
  const result = await validate(await loadTree(root, io))
  const mine = result.findings.filter((f) => f.file === path || written.includes(f.file))
  if (mine.length > 0) {
    io.stdout(toText(onlyThese(mine, 1 + written.length), io))
  }
  return EXIT.ok
}

/** A folder's title for its index, from its name: `customer-support` is
 * "Customer support". */
function folderTitle(name: string): string {
  const words = name.replace(/[-_]+/g, " ").trim()
  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(/[[\]]/g, "\\$&")
}

/** A result narrowed to the new page (and its index), counted again. */
function onlyThese(findings: ValidationResult["findings"], files: number): ValidationResult {
  const count = (severity: string) => findings.filter((f) => f.severity === severity).length
  const errors = count("error")
  return {
    findings,
    errors,
    warnings: count("warning"),
    infos: count("info"),
    concepts: 1,
    files,
    ok: errors === 0,
  }
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  )
