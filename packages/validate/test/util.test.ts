import { describeType, isDatetime, isIsoDate, show, slugify } from "../src/util.js"

describe("isDatetime", () => {
  it.each([
    "2026-06-30T14:00:00Z",
    "2026-06-30t14:00:00z",
    "2026-06-30T14:00Z",
    "2026-06-30T14:00:00.123Z",
    "2026-06-30T14:00:00+02:00",
    "2026-06-30T14:00:00-0530",
    "2024-02-29T00:00:00Z",
    "2016-12-31T23:59:60Z",
  ])("accepts %s", (value) => expect(isDatetime(value)).toBe(true))

  it.each([
    "2026-06-30",
    "2026-06-30T14:00:00",
    "2026-06-30 14:00:00Z",
    "2026-02-29T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-06-30T24:00:00Z",
    "2026-06-30T14:60:00Z",
    "2026-06-30T14:00:00+24:00",
    "2026-06-30T14:00:00+01:60",
    "June 30, 2026",
  ])("rejects %s", (value) => expect(isDatetime(value)).toBe(false))

  it("rejects non-strings", () => {
    expect(isDatetime(20260630)).toBe(false)
    expect(isDatetime(undefined)).toBe(false)
  })
})

describe("helpers", () => {
  it("checks ISO dates", () => {
    expect(isIsoDate("2026-05-22")).toBe(true)
    expect(isIsoDate("2026-02-30")).toBe(false)
    expect(isIsoDate("2026-5-22")).toBe(false)
  })

  it("shows values briefly", () => {
    expect(show("abc")).toBe("`abc`")
    expect(show([1, "a"])).toBe('`[1,"a"]`')
    expect(show("x".repeat(80))).toBe(`\`${"x".repeat(57)}...\``)
    expect(show(undefined)).toBe("`undefined`")
  })

  it("describes types", () => {
    expect([null, [], {}, 1, "s", true].map(describeType)).toEqual([
      "null",
      "a list",
      "a mapping",
      "a number",
      "a string",
      "a boolean",
    ])
  })

  it("slugifies", () => {
    expect(slugify("Events_Table")).toBe("events-table")
    expect(slugify("blocks___transactions")).toBe("blocks-transactions")
    expect(slugify("--Hello, World!--")).toBe("hello-world")
    expect(slugify("___")).toBe("")
  })
})
