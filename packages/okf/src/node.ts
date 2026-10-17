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
  const settingsText = await readFile(join(root, SETTINGS_PATH), "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return undefined
      throw error
    },
  )
  const isIgnored = ignoreMatcher(readSettings(settingsText)?.ignore ?? [])
  const files: TreeFile[] = []
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (entry.name !== ".git") await walk(join(dir, entry.name), path)
      } else if (entry.isFile()) {
        if (path === SETTINGS_PATH) {
          files.push({ path, text: settingsText ?? "" })
        } else if (path.endsWith(".md") && !isIgnored(path)) {
          files.push({ path, text: await readFile(join(dir, entry.name), "utf8") })
        } else {
          files.push({ path })
        }
      }
    }
  }
  await walk(root, "")
  return files
}
