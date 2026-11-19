import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  declaredOkfVersion,
  isTypeFilePath,
  outlineTree,
  parseTree,
  SETTINGS_PATH,
} from "@okforest/okf"
import { readTreeFiles } from "@okforest/okf/node"
import { treeChecker, validate } from "../src/index.js"
import { FIXTURES, NOW } from "./helpers.js"

const samples = ["okf-samples", "okf-samples-0.3"].flatMap((dir) => {
  const source = JSON.parse(readFileSync(join(FIXTURES, dir, "SOURCE.json"), "utf8")) as {
    bundles: string[]
  }
  return source.bundles.map((bundle) => join(dir, bundle))
})

/** Every fixture tree: each rule's, the clean one, and OKF's samples in both versions. */
const trees = [
  ...readdirSync(join(FIXTURES, "rules")).flatMap((namespace) =>
    readdirSync(join(FIXTURES, "rules", namespace)).map((name) => join("rules", namespace, name)),
  ),
  "valid",
  ...samples,
]

describe("treeChecker", () => {
  it.each(trees)("finds what validate finds, a file at a time: %s", async (dir) => {
    const files = await readTreeFiles(join(FIXTURES, dir))
    const texts = new Map(files.map((file) => [file.path, file.text]))
    const types = new Map(
      files.flatMap((file) =>
        file.text !== undefined && isTypeFilePath(file.path) ? [[file.path, file.text]] : [],
      ),
    )
    // The root index.md's version decides which rules apply, so it's read first.
    const outline = outlineTree(
      files.map((file) => file.path),
      texts.get(SETTINGS_PATH),
      types,
      {
        okfVersion: declaredOkfVersion(texts.get("index.md")),
      },
    )
    const checker = treeChecker(outline, { now: NOW })
    // In reverse, as a stream may give them in any order.
    for (const path of [...outline.markdown].reverse()) {
      await checker.check(outline.read(path, texts.get(path) ?? ""))
    }
    expect(await checker.finish()).toEqual(await validate(parseTree(files), { now: NOW }))
  })
})
