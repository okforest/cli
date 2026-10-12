#!/usr/bin/env node
// Refresh fixtures/okf-samples/ from Google's OKF repository.
//
//   pnpm fixtures:refresh            # latest commit on main
//   pnpm fixtures:refresh <ref>      # a branch, tag, or commit SHA
//
// Replaces each bundle directory wholesale, copies the upstream LICENSE.md,
// and records the exact commit in SOURCE.json. NOTICE is hand-written and left
// alone. Afterwards, run the tests: the okf-samples snapshots show exactly how
// the upstream change affects validation (`pnpm test -- -u` to accept).

import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const REPO = "GoogleCloudPlatform/open-knowledge-format"
const BUNDLES = ["acme_retail", "crypto_bitcoin", "ga4", "stackoverflow"]
const ref = process.argv[2] ?? "main"
const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "okf-samples")

const headers = { Accept: "application/vnd.github+json", "User-Agent": "okforest-fixtures" }
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

const commitRes = await fetch(`https://api.github.com/repos/${REPO}/commits/${ref}`, { headers })
if (!commitRes.ok) throw new Error(`Resolving ${ref}: HTTP ${commitRes.status}`)
const commit = await commitRes.json()
const sha = commit.sha

const tarRes = await fetch(`https://codeload.github.com/${REPO}/tar.gz/${sha}`)
if (!tarRes.ok) throw new Error(`Downloading ${sha}: HTTP ${tarRes.status}`)
const work = mkdtempSync(join(tmpdir(), "okf-samples-"))
try {
  const tar = spawnSync("tar", ["-xzf", "-", "-C", work, "--strip-components=1"], {
    input: Buffer.from(await tarRes.arrayBuffer()),
  })
  if (tar.status !== 0) throw new Error(`tar failed: ${tar.stderr}`)

  for (const bundle of BUNDLES) {
    const from = join(work, "bundles", bundle)
    if (!existsSync(from)) throw new Error(`Upstream has no bundles/${bundle} at ${sha}`)
    rmSync(join(dest, bundle), { recursive: true, force: true })
    cpSync(from, join(dest, bundle), { recursive: true })
  }
  cpSync(join(work, "LICENSE.md"), join(dest, "LICENSE.md"))

  const source = {
    repository: `https://github.com/${REPO}`,
    commit: sha,
    committed: commit.commit.committer.date,
    path: "bundles",
    bundles: BUNDLES,
    license: "Apache-2.0",
  }
  writeFileSync(join(dest, "SOURCE.json"), `${JSON.stringify(source, null, 2)}\n`)
  console.log(`fixtures/okf-samples now at ${REPO}@${sha.slice(0, 7)} (${source.committed})`)
  console.log("Run `pnpm test`; accept intended snapshot changes with `pnpm test -- -u`.")
} finally {
  rmSync(work, { recursive: true, force: true })
}
