import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { parseTree, SETTINGS_PATH } from "./tree.js"
import type { Tree, TreeFile } from "./types.js"

/** Directories never walked: version control and installed packages. */
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules"])

/**
 * Read a tree from disk and build its model with {@link parseTree}. Reads the
 * text of markdown files and `.okforest/tree.yaml`; other files are listed by
 * path only, so links to them can be checked. Symbolic links are not followed.
 */
export async function readTree(root: string): Promise<Tree> {
  return parseTree(await readTreeFiles(root))
}

/** The files {@link readTree} would hand to `parseTree`. */
export async function readTreeFiles(root: string): Promise<TreeFile[]> {
  const files: TreeFile[] = []
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) await walk(join(dir, entry.name), path)
      } else if (entry.isFile()) {
        const needsText = path.endsWith(".md") || path === SETTINGS_PATH
        files.push(
          needsText ? { path, text: await readFile(join(dir, entry.name), "utf8") } : { path },
        )
      }
    }
  }
  await walk(root, "")
  return files
}
