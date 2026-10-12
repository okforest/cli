import { createRequire } from "node:module"
import { styleText } from "node:util"

/** Where a command writes, and how. Injected so commands are testable. */
export interface Io {
  stdout(text: string): void
  stderr(text: string): void
  /** Whether to color output. */
  color: boolean
  /** Directory relative paths resolve against. */
  cwd: string
}

/** Exit codes: 0 success, 1 validation errors, 2 usage or read problems. */
export const EXIT = { ok: 0, failed: 1, usage: 2 } as const

/** Thrown for bad arguments or unreadable input; becomes exit code 2. */
export class UsageError extends Error {}

type Style = Parameters<typeof styleText>[0]

export function paint(io: Io, style: Style, text: string): string {
  return io.color ? styleText(style, text, { validateStream: false }) : text
}

// src/*.ts and the bundled dist/cli.mjs both sit one level below the package root.
const packageRoot = new URL("../", import.meta.url)

export const VERSION: string = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version

export const TEMPLATES_DIR = new URL("templates/", packageRoot)
