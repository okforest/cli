import { join } from "node:path"
import type { Io } from "../src/io.js"
import { main } from "../src/main.js"

export const FIXTURES = join(import.meta.dirname, "..", "..", "..", "fixtures")

/** Run the CLI in-process and capture what it writes. */
export async function run(args: string[], options: { cwd?: string; color?: boolean } = {}) {
  let stdout = ""
  let stderr = ""
  const io: Io = {
    stdout: (text) => {
      stdout += text
    },
    stderr: (text) => {
      stderr += text
    },
    color: options.color ?? false,
    cwd: options.cwd ?? FIXTURES,
  }
  const code = await main(args, io)
  return { code, stdout, stderr }
}
