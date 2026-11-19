import { readFileSync } from "node:fs"
import { join } from "node:path"
import { FIXTURES, lines, validateDir } from "./helpers.js"

// OKF's sample bundles, in both versions: fixtures/okf-samples (OKF 0.2,
// from Google's deprecated repository) and fixtures/okf-samples-0.3
// (refreshed with `pnpm fixtures:refresh`). They are conformant: no errors.
// Warnings are genuine issues; the snapshots make any upstream change
// reviewable.
const samples = ["okf-samples", "okf-samples-0.3"].flatMap((dir) => {
  const source = JSON.parse(readFileSync(join(FIXTURES, dir, "SOURCE.json"), "utf8")) as {
    bundles: string[]
  }
  // Named with "/" on every platform, so the snapshots' names match.
  return source.bundles.map((bundle) => `${dir}/${bundle}`)
})

describe("OKF sample bundles", () => {
  it.each(samples)("%s", async (bundle) => {
    const result = await validateDir(join(FIXTURES, bundle))
    expect(result.errors).toBe(0)
    expect({
      concepts: result.concepts,
      files: result.files,
      findings: lines(result.findings),
    }).toMatchSnapshot()
  })
})
