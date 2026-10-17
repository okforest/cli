import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { ignoreMatcher, parseTree, readSettings, SETTINGS_PATH } from "./tree.js"
import type { Tree, TreeFile } from "./types.js"

/**
 * Read a tree from disk and build its model with {@link parseTree}. Reads the
 * text of `.okforest/settings.yaml` and of markdown files its `ignore:` globs
 * don't leave out; other files are listed by path only, so links to them can
 * be checked. `.git/` is not walked, and symbolic links are not followed.
 */
export async function readTree(root: string): Promise<Tree> {
  return parseTree(await readTreeFiles(root))
}

/** The files {@link readTree} would hand to `parseTree`. */
export async function readTreeFiles(root: string): Promise<TreeFile[]> {
  const paths: string[] = []
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (entry.name !== ".git") await walk(join(dir, entry.name), path)
      } else if (entry.isFile()) {
        paths.push(path)
      }
    }
  }
  await walk(root, "")

  const read = (path: string) => readFile(join(root, path), "utf8")
  const settingsText = paths.includes(SETTINGS_PATH) ? await read(SETTINGS_PATH) : undefined
  const isIgnored = ignoreMatcher(readSettings(settingsText)?.ignore ?? [])
  const files: TreeFile[] = []
  for (const path of paths) {
    if (path === SETTINGS_PATH) files.push({ path, text: settingsText as string })
    else if (path.endsWith(".md") && !isIgnored(path)) files.push({ path, text: await read(path) })
    else files.push({ path })
  }
  return files
}
