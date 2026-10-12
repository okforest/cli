import { readFileSync } from "node:fs"
import { join } from "node:path"
import { HELP, main } from "../src/main.js"
import { run } from "./helpers.js"

const version = (
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
    version: string
  }
).version

describe("okforest", () => {
  it("prints help and exits 2 with no command", async () => {
    expect(await run([])).toEqual({ code: 2, stdout: HELP, stderr: "" })
  })

  it.each([["--help"], ["-h"], ["help"]])("prints help for %s", async (flag) => {
    expect(await run([flag])).toEqual({ code: 0, stdout: HELP, stderr: "" })
  })

  it.each([["--version"], ["-v"]])("prints the package version for %s", async (flag) => {
    expect(await run([flag])).toEqual({ code: 0, stdout: `${version}\n`, stderr: "" })
  })

  it("rejects unknown commands and options with exit 2", async () => {
    expect(await run(["frob"])).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/Unknown command `frob`/),
    })
    expect(await run(["toString"])).toMatchObject({ code: 2 })
    expect(await run(["validate", "--bogus"])).toMatchObject({
      code: 2,
      stderr: expect.stringMatching(/^okforest: Unknown option/),
    })
    expect(await run(["validate", "a", "b"])).toMatchObject({
      code: 2,
      stderr: "okforest: Expected one path, got 2: a b\n",
    })
  })

  it.each([["validate"], ["inventory"], ["init"]])(
    "prints help for `%s --help`",
    async (command) => {
      const result = await run([command, "--help"])
      expect(result.code).toBe(0)
      expect(result.stdout).toMatch(new RegExp(`^Usage: okforest ${command} `))
    },
  )

  it("rethrows unexpected errors, such as a broken output stream", async () => {
    const failing = () => {
      throw new Error("EPIPE")
    }
    await expect(
      main(["--version"], { stdout: failing, stderr: failing, color: false, cwd: "." }),
    ).rejects.toThrow("EPIPE")
  })
})
