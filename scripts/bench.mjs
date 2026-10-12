#!/usr/bin/env node
// Time the validator on a large synthetic tree, to catch performance
// regressions in review.
//
//   pnpm bench          # 400 copies of the stackoverflow sample (~10,000 concepts)
//   pnpm bench 50       # fewer copies
//
// Builds the tree in a temporary directory from fixtures/okf-samples, then
// reports the time to read files, parse the tree, and run the rules. Runs
// single-threaded, like CI. Numbers are machine-dependent: compare runs on the
// same machine, and expect GitHub's 2-vCPU private-repo runners to be slower.

import { cpSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseTree } from "../packages/okf/dist/index.mjs"
import { readTreeFiles } from "../packages/okf/dist/node.mjs"
import { validate } from "../packages/validate/dist/index.mjs"

const copies = Number(process.argv[2] ?? 400)
const sample = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "okf-samples",
  "stackoverflow",
)
const dir = mkdtempSync(join(tmpdir(), "okforest-bench-"))
try {
  for (let i = 1; i <= copies; i++) cpSync(sample, join(dir, `copy-${i}`), { recursive: true })
  const markdown = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) =>
    f.endsWith(".md"),
  )
  const megabytes = markdown.reduce((n, f) => n + statSync(join(dir, f)).size, 0) / 1e6

  const time = async (fn) => {
    const start = performance.now()
    const value = await fn()
    return [value, (performance.now() - start) / 1000]
  }
  const [files, read] = await time(() => readTreeFiles(dir))
  const [tree, parse] = await time(() => parseTree(files))
  const [result, rules] = await time(() => validate(tree))

  const row = (label, seconds) => console.log(`  ${label.padEnd(8)} ${seconds.toFixed(2)} s`)
  console.log(
    `${tree.concepts.length} concepts, ${markdown.length} markdown files, ${megabytes.toFixed(1)} MB` +
      ` (${result.findings.length} findings)`,
  )
  row("read", read)
  row("parse", parse)
  row("rules", rules)
  row("total", read + parse + rules)
  console.log(`  parse    ${(megabytes / parse).toFixed(1)} MB/s`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
