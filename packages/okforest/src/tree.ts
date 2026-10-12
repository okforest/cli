import { stat } from "node:fs/promises"
import { resolve } from "node:path"
import type { Tree } from "@okforest/okf"
import { readTree } from "@okforest/okf/node"
import { type Io, UsageError } from "./io.js"

/** Read the tree at a user-supplied path, or explain why not. */
export async function loadTree(path: string, io: Io): Promise<Tree> {
  const dir = resolve(io.cwd, path)
  const info = await stat(dir).catch(() => undefined)
  if (!info) throw new UsageError(`No such directory: ${path}`)
  if (!info.isDirectory())
    throw new UsageError(`Not a directory: ${path} (give the tree's root folder).`)
  try {
    return await readTree(dir)
  } catch (error) {
    throw new UsageError(`Could not read ${path}: ${(error as Error).message}`)
  }
}
