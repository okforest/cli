import { concept, only } from "./helpers.js"

// Branches the per-rule fixtures don't reach. Each test names the rule it covers.

describe("okf/okf-version", () => {
  it("asks for a root index.md when there is none", async () => {
    expect(await only("okf/okf-version", { "a.md": concept() })).toEqual([
      'index.md:-:- info okf/okf-version No root index.md: add one declaring `okf_version: "0.2"` and listing the top-level directories.',
    ])
  })

  it("asks for an unquoted version to be quoted", async () => {
    expect(await only("okf/okf-version", { "index.md": "---\nokf_version: 0.2\n---\n" })).toEqual([
      'index.md:2:1 info okf/okf-version Quote `okf_version` so it reads as a string: `okf_version: "0.2"`.',
    ])
  })

  it("notes best-effort checking of other versions", async () => {
    expect(await only("okf/okf-version", { "index.md": '---\nokf_version: "0.3"\n---\n' })).toEqual(
      [
        'index.md:2:1 info okf/okf-version This validator implements OKF 0.2; `okf_version: "0.3"` is checked best-effort.',
      ],
    )
    expect(await only("okf/okf-version", { "index.md": '---\nokf_version: "0.2"\n---\n' })).toEqual(
      [],
    )
  })
})

describe("okf/frontmatter and okf/type", () => {
  it("reports unreadable frontmatter in reserved files, but not missing frontmatter", async () => {
    expect(
      await only("okf/frontmatter", {
        "index.md": "---\nokf_version: [\n---\n",
        "log.md": "# Log\n",
      }),
    ).toEqual([expect.stringMatching(/^index\.md:2:\d+ error okf\/frontmatter Invalid YAML/)])
  })

  it("does not ask for a type when the frontmatter is unreadable", async () => {
    expect(await only("okf/type", { "a.md": "---\ntype: [\n---\n" })).toEqual([])
  })
})

describe("okf/index-entries", () => {
  it("accepts reference-style entry links", async () => {
    expect(
      await only("okf/index-entries", {
        "index.md": "# A\n\n* [Orders][o] - Orders.\n\n[o]: orders.md\n",
      }),
    ).toEqual([])
  })

  it("flags list items without a leading paragraph", async () => {
    expect(await only("okf/index-entries", { "index.md": "# A\n\n* \n" })).toEqual([
      "index.md:3:1 warning okf/index-entries Index entries should start with a link: `* [Title](path) - description`.",
    ])
  })
})

describe("okf/log-date", () => {
  it("ignores headings other than level two", async () => {
    expect(
      await only("okf/log-date", { "log.md": "# History\n\n### Notes\n\n## 2026-01-01\n" }),
    ).toEqual([])
  })
})

describe("okf/sources", () => {
  it("checks a per-source usage window and non-string ids", async () => {
    expect(
      await only("okf/sources", {
        "a.md": concept(
          "sources:\n  - { id: 7, resource: x, usage_window: [a] }\n  - { id: '', resource: y }",
        ),
      }),
    ).toEqual([
      "a.md:6:7 error okf/sources A source `id` must be a non-empty string (footnotes cite it).",
      "a.md:6:27 error okf/sources `usage_window` must be a `{ from, to }` mapping of datetimes.",
      "a.md:7:7 error okf/sources A source `id` must be a non-empty string (footnotes cite it).",
    ])
  })
})

describe("okf/datetime", () => {
  it("checks every verification in a list and skips unreadable windows", async () => {
    expect(
      await only("okf/datetime", {
        "a.md": concept(
          "verified:\n  - { by: human:a, at: 2026-01-01T00:00:00Z }\n  - { by: human:b, at: yesterday }\n  - nope\nusage_window: nope\nsources: [nope]",
        ),
      }),
    ).toEqual([
      "a.md:7:20 error okf/datetime `verified[1].at` must be an ISO 8601 datetime with an explicit UTC offset, such as `2026-12-31T00:00:00Z` (got `yesterday`).",
    ])
  })
})

describe("okf/actor", () => {
  it("accepts the three actor forms and ignores non-strings", async () => {
    expect(
      await only("okf/actor", {
        "a.md": concept(
          "generated: { by: reference_agent/gemini-2.5-pro }\nverified:\n  - { by: human:jane@acme.example, at: 2026-01-01T00:00:00Z }\n  - { by: process:nightly, at: 2026-01-01T00:00:00Z }\n  - { by: 7 }\n  - nope",
        ),
      }),
    ).toEqual([])
  })
})

describe("okf/attested-computation", () => {
  const ac = (extra: string, body = "") =>
    `---\ntype: Attested Computation\ntitle: X\ndescription: X.\n${extra}\n---\n\n${body}\n`

  it("accepts a computation file instead of an inline block", async () => {
    expect(
      await only("okf/attested-computation", {
        "c.md": ac("runtime: dbt\ncomputation: lib/revenue.sql"),
      }),
    ).toEqual([])
  })

  it("finds the computation only under its own heading", async () => {
    const body =
      "# Computation\n\nProse.\n\n## Detail\n\n    SELECT 1\n\n# Notes\n\n```sql\nSELECT 2\n```\n"
    expect(
      await only("okf/attested-computation", { "c.md": ac("runtime: bigquery", body) }),
    ).toEqual([])
    const outside = "# Computation\n\nProse only.\n\n# Notes\n\n```sql\nSELECT 2\n```\n"
    expect(
      await only("okf/attested-computation", { "c.md": ac("runtime: bigquery", outside) }),
    ).toEqual([
      "c.md:2:1 error okf/attested-computation No computation: add a code block under a `# Computation` heading, or set `computation` to a file path.",
    ])
  })

  it("reports a blank runtime at the runtime key and a non-list of parameters", async () => {
    expect(
      await only("okf/attested-computation", {
        "c.md": ac("runtime: ' '\nparameters: year\ncomputation: x.sql"),
      }),
    ).toEqual([
      "c.md:5:1 error okf/attested-computation An Attested Computation needs `runtime`, e.g. `runtime: bigquery`.",
      "c.md:6:1 error okf/attested-computation `parameters` must be a list of `{ name, type, required }` mappings.",
    ])
  })
})

describe("okf/broken-link", () => {
  it("accepts explicit path fields that resolve to files or directories", async () => {
    expect(
      await only("okf/broken-link", {
        "a/b.md": concept(
          "resource: ../refs/\ncomputation: ./c.sql\nexecutor: { resource: /refs/run.md }\nattester: nope\nsources:\n  - nope\n  - { resource: '/#top' }",
        ),
        "a/c.sql": undefined,
        "refs/run.md": concept(),
      }),
    ).toEqual([])
  })
})

describe("okf/footnote-source", () => {
  it("is quiet when the concept keys no sources", async () => {
    expect(
      await only("okf/footnote-source", { "a.md": concept("", "Note.[^1]\n\n[^1]: A note.") }),
    ).toEqual([])
  })
})

describe("okf/legacy-v01", () => {
  it("ignores a Citations heading below the top level", async () => {
    expect(
      await only("okf/legacy-v01", { "a.md": concept("", "- item\n\n  # Citations") }),
    ).toEqual([])
  })
})

describe("okforest/placeholder", () => {
  it("reports positions inside multi-line text and template links", async () => {
    expect(
      await only("okforest/placeholder", {
        "a.md": concept(
          "",
          "First line\nsecond {{name}} line [x]({{url}}) ![i](%7B%7Bimg%7D%7D)\n\n<details>\n\n<placeholder/>",
        ),
      }),
    ).toEqual([
      "a.md:8:8 warning okforest/placeholder Unrendered template placeholder `{{name}}`.",
      "a.md:8:22 warning okforest/placeholder Link to a placeholder or example path `{{url}}`.",
      "a.md:8:35 warning okforest/placeholder Link to a placeholder or example path `%7B%7Bimg%7D%7D`.",
      "a.md:12:1 warning okforest/placeholder Unrendered placeholder `<placeholder/>`.",
    ])
  })

  it("checks index.md and log.md too", async () => {
    expect(await only("okforest/placeholder", { "index.md": "# {% raw %}\n" })).toEqual([
      "index.md:1:3 warning okforest/placeholder Unrendered template tag `{% raw %}`.",
    ])
  })
})

describe("okforest/wikilink", () => {
  it("suggests a generic path when the name has no letters or digits", async () => {
    expect(await only("okforest/wikilink", { "a.md": concept("", "[[!!]]") })).toEqual([
      "a.md:7:1 warning okforest/wikilink `[[!!]]` is a wikilink, not an OKF link: write `[!!](concept.md)` with the concept's path.",
    ])
  })
})

describe("okforest/slug", () => {
  it("does not judge reserved file names", async () => {
    expect(await only("okforest/slug", { "index.md": "# A\n", "notes/a-b.md": concept() })).toEqual(
      [],
    )
  })

  it("does not suggest the same name back", async () => {
    expect(await only("okforest/slug", { "-.md": concept() })).toEqual([
      "-.md:-:- warning okforest/slug File name `-` is not a slug: use lowercase letters, digits, and hyphens.",
    ])
  })
})

describe("okforest/settings", () => {
  const settings = (text: string) => only("okforest/settings", { ".okforest/settings.yaml": text })

  it("is quiet without settings and for a well-formed file", async () => {
    expect(await only("okforest/settings", { "a.md": concept() })).toEqual([])
    expect(await settings("")).toEqual([])
    expect(await settings("name: Sales\ndescription: Deals.\nignore: []\n")).toEqual([])
  })

  it("reports unreadable settings", async () => {
    expect(await settings("name: [\n")).toEqual([
      expect.stringMatching(/^\.okforest\/settings\.yaml:\d+:\d+ error okforest\/settings /),
    ])
  })

  it("checks name, description, and ignore entries", async () => {
    expect(await settings(`name: 7\ndescription: ${"d".repeat(4001)}\nignore: [ok, 3]\n`)).toEqual([
      ".okforest/settings.yaml:1:1 error okforest/settings `name` must be text (got a number).",
      ".okforest/settings.yaml:2:1 error okforest/settings `description` is 4,001 characters; the limit is 4,000.",
      ".okforest/settings.yaml:3:14 error okforest/settings Each `ignore` entry must be a glob string.",
    ])
    expect(await settings(`name: ${"🌲".repeat(100)}\n`)).toEqual([])
    expect(await settings("ignore: drafts/\n")).toEqual([
      ".okforest/settings.yaml:1:1 error okforest/settings `ignore` must be a list of globs relative to the bundle root.",
    ])
  })

  it("reports a .yml settings file, which is never read", async () => {
    expect(
      await only("okforest/settings", { ".okforest/settings.yml": "name: x\n", "a.md": concept() }),
    ).toEqual([
      ".okforest/settings.yml:1:1 error okforest/settings Rename `.okforest/settings.yml` to `.okforest/settings.yaml`: only the `.yaml` name is read, so these settings are ignored.",
    ])
  })
})

describe("okforest/settings-keys", () => {
  const keys = (text: string) => only("okforest/settings-keys", { ".okforest/settings.yaml": text })

  it("is quiet for known settings", async () => {
    expect(await keys("name: n\ndescription: d\nignore: []\n")).toEqual([])
  })

  it("names a likely misspelling, and lists the settings otherwise", async () => {
    expect(await keys("nmae: Sales\ncolor: green\n")).toEqual([
      ".okforest/settings.yaml:1:1 warning okforest/settings-keys Unknown setting `nmae`: did you mean `name`? Unknown settings are ignored.",
      ".okforest/settings.yaml:2:1 warning okforest/settings-keys Unknown setting `color`, ignored. The settings are `name`, `description`, `ignore`.",
    ])
  })
})
