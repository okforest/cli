import { readTypeTemplate, startPage } from "../src/index.js"

const METRIC = `---
type: Metric   # every Metric
title:
status: draft
unit:
owner:
tags: [metric]
---

<!-- One sentence: what is counted, and over what period. -->

# Definition
`

const template = (text: string) => readTypeTemplate(".okforest/types/metric.template.md", text)

describe("startPage", () => {
  it("sets the title in place and keeps every other byte of the template", () => {
    expect(startPage({ type: "Metric", title: "Monthly churn" }, template(METRIC))).toBe(
      METRIC.replace("title:\n", "title: Monthly churn\n"),
    )
  })

  it("adds a missing title after type, and a description after it", () => {
    const text = METRIC.replace("title:\n", "")
    expect(
      startPage(
        { type: "Metric", title: "Monthly churn", description: "Customers who cancel: a share." },
        template(text),
      ),
    ).toBe(
      text.replace(
        "type: Metric   # every Metric\n",
        'type: Metric   # every Metric\ntitle: Monthly churn\ndescription: "Customers who cancel: a share."\n',
      ),
    )
  })

  it("replaces a title the template already fills, keeping a comment after it", () => {
    const text = "---\ntype: Metric\ntitle: A metric # rename me\n---\n"
    expect(startPage({ type: "Metric", title: "Churn" }, template(text))).toBe(
      "---\ntype: Metric\ntitle: Churn # rename me\n---\n",
    )
  })

  it("leaves the template's fields when none are given", () => {
    expect(startPage({ type: "Metric" }, template(METRIC))).toBe(METRIC)
  })

  it("replaces a multi-line value whole", () => {
    const text = "---\ntype: Metric\ndescription: >\n  A long\n  description.\nowner:\n---\n"
    expect(startPage({ type: "Metric", description: "Short." }, template(text))).toBe(
      "---\ntype: Metric\ndescription: Short.\nowner:\n---\n",
    )
  })

  it("adds the title first when the template has no type", () => {
    const text = "---\nowner:\n---\n"
    expect(startPage({ type: "Metric", title: "Churn" }, template(text))).toBe(
      "---\ntitle: Churn\nowner:\n---\n",
    )
  })

  it("adds a line to front matter whose last line has no newline", () => {
    expect(startPage({ type: "Metric", title: "Churn" }, template("---\ntype: Metric\n---"))).toBe(
      "---\ntype: Metric\ntitle: Churn\n---",
    )
  })

  it("adds a title to an empty block", () => {
    expect(startPage({ type: "Metric", title: "Churn" }, template("---\n---\nBody\n"))).toBe(
      "---\ntitle: Churn\n---\nBody\n",
    )
  })

  it("adds a title after a type left empty, and after a block value", () => {
    expect(
      startPage({ type: "Metric", title: "Churn" }, template("---\ntype:\nowner:\n---\n")),
    ).toBe("---\ntype:\ntitle: Churn\nowner:\n---\n")
    expect(
      startPage(
        { type: "Metric", description: "Short." },
        template("---\ntype: Metric\ntitle: >\n  Monthly\n  churn\nowner:\n---\n"),
      ),
    ).toBe("---\ntype: Metric\ntitle: >\n  Monthly\n  churn\ndescription: Short.\nowner:\n---\n")
  })

  it("leaves keys that aren't text alone", () => {
    const text = "---\n? [a, b]\n: pair\ntype: Metric\n---\n"
    expect(startPage({ type: "Metric", title: "Churn" }, template(text))).toBe(
      "---\n? [a, b]\n: pair\ntype: Metric\ntitle: Churn\n---\n",
    )
  })

  it("writes just type, title, and description without a usable template", () => {
    const plain = "---\ntype: Metric\ntitle: Monthly churn\n---\n\n"
    expect(startPage({ type: "Metric", title: "Monthly churn" })).toBe(plain)
    expect(startPage({ type: "Metric", description: "Churn." })).toBe(
      "---\ntype: Metric\ndescription: Churn.\n---\n\n",
    )
    expect(
      startPage({ type: "Metric", title: "Monthly churn" }, template("# No front matter\n")),
    ).toBe(plain)
    expect(startPage({ type: "Metric", title: "Monthly churn" }, template("---\n- a\n---\n"))).toBe(
      plain,
    )
  })
})

describe("readTypeTemplate", () => {
  it("names the type its front matter gives", () => {
    expect(template(METRIC)).toMatchObject({ name: "Metric", hasFrontmatter: true })
    expect(template("---\ntype: '  '\n---\n").name).toBeUndefined()
    expect(template("---\ntype: [Metric]\n---\n").name).toBeUndefined()
  })
})
