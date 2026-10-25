import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { outlineTree, parseTree, SETTINGS_PATH } from "@okforest/okf"
import { readTreeFiles } from "@okforest/okf/node"
import { treeChecker, validate } from "../src/index.js"
import { FIXTURES, NOW } from "./helpers.js"

const samples = JSON.parse(readFileSync(join(FIXTURES, "okf-samples", "SOURCE.json"), "utf8")) as {
  bundles: string[]
}

/** Every fixture tree: each rule's, the clean one, and Google's samples. */
const trees = [
  ...readdirSync(join(FIXTURES, "rules")).flatMap((namespace) =>
    readdirSync(join(FIXTURES, "rules", namespace)).map((name) => join("rules", namespace, name)),
  ),
  "valid",
  ...samples.bundles.map((bundle) => join("okf-samples", bundle)),
]

describe("treeChecker", () => {
  it.each(trees)("finds what validate finds, a file at a time: %s", async (dir) => {
    const files = await readTreeFiles(join(FIXTURES, dir))
    const texts = new Map(files.map((file) => [file.path, file.text]))
    const outline = outlineTree(
      files.map((file) => file.path),
      texts.get(SETTINGS_PATH),
    )
    const checker = treeChecker(outline, { now: NOW })
    // In reverse, as a stream may give them in any order.
    for (const path of [...outline.markdown].reverse()) {
      await checker.check(outline.read(path, texts.get(path) ?? ""))
    }
    expect(await checker.finish()).toEqual(await validate(parseTree(files), { now: NOW }))
  })
})
