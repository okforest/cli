import { readFileSync } from "node:fs"
import { join } from "node:path"
import { FIXTURES, lines, validateDir } from "./helpers.js"

// Google's OKF sample bundles (fixtures/okf-samples, refreshed with
// `pnpm fixtures:refresh`). They are conformant: no errors. Warnings are
// genuine issues; the snapshots make any upstream change reviewable.
const source = JSON.parse(readFileSync(join(FIXTURES, "okf-samples", "SOURCE.json"), "utf8")) as {
  bundles: string[]
}

describe("OKF sample bundles", () => {
  it.each(source.bundles)("%s", async (bundle) => {
    const result = await validateDir(join(FIXTURES, "okf-samples", bundle))
    expect(result.errors).toBe(0)
    expect({
      concepts: result.concepts,
      files: result.files,
      findings: lines(result.findings),
    }).toMatchSnapshot()
  })
})
