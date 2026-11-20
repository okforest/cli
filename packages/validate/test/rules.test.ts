import { concept, lines, only, validateFiles } from "./helpers.js"

// Branches the per-rule fixtures don't reach. Each test names the rule it covers.

describe("okf/okf-version", () => {
  it("asks for a root index.md when there is none", async () => {
    expect(await only("okf/okf-version", { "a.md": concept() })).toEqual([
      'index.md:-:- info okf/okf-version No root index.md: add one declaring `okf_version: "0.3"` and listing the top-level directories.',
    ])
  })

  it("asks for an unquoted version to be quoted", async () => {
    expect(await only("okf/okf-version", { "index.md": "---\nokf_version: 0.2\n---\n" })).toEqual([
      'index.md:2:1 info okf/okf-version Quote `okf_version` so it reads as a string: `okf_version: "0.2"`.',
    ])
  })

  it("accepts any version it can read, and says when it can't read one", async () => {
    for (const version of ['"0.2"', '"0.3"', '"0.4"']) {
      const index = `---\nokf_version: ${version}\n---\n`
      expect(await only("okf/okf-version", { "index.md": index })).toEqual([])
    }
    expect(await only("okf/okf-version", { "index.md": '---\nokf_version: "v3"\n---\n' })).toEqual([
      'index.md:2:1 info okf/okf-version `okf_version` is `<major>.<minor>`, such as `"0.3"` (got `v3`); until it is, the bundle is read as OKF 0.2.',
    ])
  })
})

describe("okforest/okf-version-current", () => {
  const version = (v: string) => ({ "index.md": `---\nokf_version: ${v}\n---\n` })

  it("says nothing of the current version, or none", async () => {
    expect(await only("okforest/okf-version-current", version('"0.3"'))).toEqual([])
    expect(await only("okforest/okf-version-current", { "index.md": "# Root\n" })).toEqual([])
  })

  it("tells a tree behind the current version, and one ahead of this validator", async () => {
    expect(await only("okforest/okf-version-current", version('"0.2"'))).toEqual([
      expect.stringMatching(
        /^index\.md:2:1 warning .* declares OKF 0\.2; 0\.3 is current\. Move when/,
      ),
    ])
    expect(await only("okforest/okf-version-current", version("0.4"))).toEqual([
      expect.stringMatching(
        /declares OKF 0\.4, newer than this validator knows \(0\.3\).*update okforest/,
      ),
    ])
  })
})

/** A root index.md declaring a version, and the files beside it. */
const at = (okfVersion: string, files: Record<string, string | undefined>) => ({
  "index.md": `---\nokf_version: "${okfVersion}"\n---\n`,
  ...files,
})

describe("concepts under OKF 0.2 and 0.3 (§3.2)", () => {
  const files = { "README.md": "# Readme\n", "note.md": "---\ntitle: Untyped\n---\n" }

  it("reports a markdown file without frontmatter or type as an error under 0.2", async () => {
    const findings = lines((await validateFiles(at("0.2", files))).findings)
    expect(findings).toContainEqual(
      expect.stringMatching(/^README\.md:1:1 error okf\/frontmatter No frontmatter/),
    )
    expect(findings).toContainEqual(
      "note.md:1:1 error okf/type Missing `type`, the one required key.",
    )
    expect(findings.some((f) => f.includes("okf/not-a-concept"))).toBe(false)
  })

  it("says it isn't a concept under 0.3, and checks it no further", async () => {
    const findings = lines((await validateFiles(at("0.3", files))).findings)
    expect(findings.filter((f) => !f.includes("okf/index-entries"))).toEqual([
      expect.stringMatching(
        /^README\.md:1:1 warning okf\/not-a-concept Not a concept: it has no frontmatter/,
      ),
      expect.stringMatching(
        /^note\.md:1:1 warning okf\/not-a-concept Not a concept: its frontmatter has no `type`/,
      ),
    ])
  })

  it("counts only concepts, and leaves an unreadable block to okf/frontmatter", async () => {
    const broken = { ...files, "broken.md": "---\ntype: [\n---\n", "a.md": concept() }
    const result = await validateFiles(at("0.3", broken))
    expect(result.concepts).toBe(1)
    expect(lines(result.findings).filter((f) => f.startsWith("broken.md"))).toEqual([
      expect.stringMatching(/^broken\.md:\d+:\d+ error okf\/frontmatter /),
    ])
    expect((await validateFiles(at("0.2", broken))).concepts).toBe(4)
  })
})

describe("OKF 0.3's own rules", () => {
  it("asks for x- extension keys under 0.3 only", async () => {
    const page = {
      "a.md": concept("owner: cfo\nx-unit: usd\ntimestamp: 2026-01-01T00:00:00Z"),
    }
    expect(await only("okf/extension-key", at("0.3", page))).toEqual([
      expect.stringMatching(
        /^a\.md:\d+:1 warning okf\/extension-key `owner` isn't a key OKF defines.*`x-owner`/,
      ),
    ])
    expect(await only("okf/extension-key", at("0.2", page))).toEqual([])
    // A key with no letters or digits to keep still gets a usable suggestion.
    const symbols = { "a.md": concept('"€€": 1') }
    expect(await only("okf/extension-key", at("0.3", symbols))).toEqual([
      expect.stringMatching(/`€€` isn't a key OKF defines.*such as `x-key`/),
    ])
  })

  it("keeps log.md free of frontmatter under 0.3 only", async () => {
    const log = { "log.md": "---\ntitle: Log\n---\n# Log\n" }
    expect(await only("okf/log-frontmatter", at("0.3", log))).toHaveLength(1)
    expect(await only("okf/log-frontmatter", at("0.2", log))).toEqual([])
  })

  it("pairs superseded_by with deprecated, under 0.3 only", async () => {
    const page = (fm: string) => ({ "a.md": concept(fm) })
    expect(
      await only("okf/status", at("0.3", page("status: deprecated\nsuperseded_by: b.md"))),
    ).toEqual([])
    expect(await only("okf/status", at("0.3", page("superseded_by: b.md")))).toEqual([
      expect.stringMatching(/`superseded_by` means something only with `status: deprecated`/),
    ])
    expect(
      await only("okf/status", at("0.3", page("status: deprecated\nsuperseded_by: 3"))),
    ).toEqual([
      expect.stringMatching(
        /`superseded_by` must be the path of the concept that replaces this one/,
      ),
    ])
    expect(await only("okf/status", at("0.2", page("superseded_by: b.md")))).toEqual([])
  })

  it("asks each computation parameter for a type under 0.3 only", async () => {
    const computation = {
      "c.md":
        "---\ntype: Attested Computation\nruntime: bigquery\nparameters:\n  - { name: year }\nexecutor: { resource: run.md }\nattester: { resource: check.py }\n---\n# Computation\n\n```sql\nSELECT 1\n```\n",
    }
    expect(await only("okf/attested-computation", at("0.3", computation))).toEqual([
      expect.stringMatching(/Each parameter needs a `type`/),
    ])
    expect(await only("okf/attested-computation", at("0.2", computation))).toEqual([])
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

describe("okf/index-scope", () => {
  it("accepts entries within the directory, deeper ones, absolute ones, and other sites", async () => {
    expect(
      await only("okf/index-scope", {
        "sales/index.md":
          "# Sales\n\n* [Playbook](playbook.md) - How we sell.\n* [Deals](/sales/deals/big.md) - Ours.\n* [Itself](./) - This.\n* [Site](https://acme.example) - Ours.\n* [Ref][r] - Ref.\n\n[r]: playbook.md\n",
        "sales/playbook.md": concept(),
        "sales/deals/big.md": concept(),
      }),
    ).toEqual([])
    // A root index lists the whole bundle.
    expect(
      await only("okf/index-scope", {
        "index.md": "# All\n\n* [Big](sales/deals/big.md) - Ours.\n",
        "sales/deals/big.md": concept(),
      }),
    ).toEqual([])
  })

  it("flags an entry outside the directory, or above the bundle, but not links later in an entry", async () => {
    expect(
      await only("okf/index-scope", {
        "sales/index.md":
          "# Sales\n\n* [Plans](/pricing/plans.md) - See also [ours](../pricing/plans.md).\n",
        "index.md": "# All\n\n* [Up](../elsewhere.md) - Outside.\n",
        "pricing/plans.md": concept(),
      }),
    ).toEqual([
      "index.md:3:3 warning okf/index-scope Index entries list this directory's contents (OKF §8): `../elsewhere.md` is outside it. Link to it from a concept instead.",
      "sales/index.md:3:3 warning okf/index-scope Index entries list this directory's contents (OKF §8): `/pricing/plans.md` is outside it. Link to it from a concept instead.",
    ])
  })
})

describe("okf/index-frontmatter", () => {
  const root = (frontmatter: string) => `---\n${frontmatter}---\n\n# Bundle\n`
  const META =
    "title: Acme retail\ndescription: Sales and margin.\nlicense: CC-BY-4.0\nx-owner: team:fpa\n"

  it("lets an OKF 0.3 root index.md describe the bundle, with extension keys", async () => {
    for (const version of ['"0.3"', "0.3", '"0.4"', '"1.0"']) {
      const index = root(`okf_version: ${version}\n${META}`)
      expect(await only("okf/index-frontmatter", { "index.md": index })).toEqual([])
    }
  })

  it("keeps OKF 0.2's rule for a root index.md that declares 0.2, or no version", async () => {
    for (const version of ['okf_version: "0.2"\n', "okf_version: 0.2\n", ""]) {
      const index = root(`${version}title: Acme retail\n`)
      expect(await only("okf/index-frontmatter", { "index.md": index })).toEqual([
        expect.stringMatching(
          /^index\.md:\d+:1 error okf\/index-frontmatter Under OKF 0\.2, .* remove `title`, or declare `okf_version: "0\.3"`\.$/,
        ),
      ])
    }
  })

  it("keeps a folder's index.md free of frontmatter under OKF 0.3 too", async () => {
    const files = {
      "index.md": root('okf_version: "0.3"\n'),
      "sales/index.md": root("title: Sales\n"),
    }
    expect(await only("okf/index-frontmatter", files)).toEqual([
      "sales/index.md:1:1 error okf/index-frontmatter Only the bundle-root index.md may have frontmatter; remove this block.",
    ])
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

  it("flags an index that lists nothing only when its directory has something to list", async () => {
    const root = '---\nokf_version: "0.2"\n---\n\n# A\n'
    expect(
      await only("okf/index-entries", {
        "index.md": root,
        "log.md": "# Log\n",
        "sales/index.md": "# Sales\n",
      }),
    ).toEqual([
      "index.md:4:1 warning okf/index-entries This index lists nothing: add `* [Title](path) - description` entries.",
    ])
    expect(await only("okf/index-entries", { "index.md": root, "log.md": "# Log\n" })).toEqual([])
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
      "a.md:7:20 error okf/datetime `verified[1].at` must be an ISO 8601 date-time with an explicit UTC offset, such as `2026-12-31T00:00:00Z`, or a date, `2026-12-31` (got `yesterday`).",
    ])
  })

  it("accepts a date, the start of that day in UTC (OKF 0.3 §5)", async () => {
    expect(await only("okf/datetime", { "a.md": concept("stale_after: 2026-12-31") })).toEqual([])
  })
})

describe("okf/actor", () => {
  it("accepts any scheme, and checks a source's author too (OKF 0.3 §7)", async () => {
    expect(
      await only("okf/actor", {
        "a.md": concept(
          "verified:\n  - { by: team:fpa, at: 2026-01-01T00:00:00Z }\n  - { by: bot:release, at: 2026-01-01T00:00:00Z }\nsources:\n  - { resource: https://acme.example, author: Jane Doe }",
        ),
      }),
    ).toEqual([
      expect.stringMatching(/^a\.md:\d+:\d+ warning okf\/actor `Jane Doe` is not an actor/),
    ])
  })

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

  it("checks bare path fields under OKF 0.3, from the concept's folder", async () => {
    const files = {
      "a/b.md": concept(
        [
          "resource: refs/run.md",
          "computation: c.sql",
          "superseded_by: gone.md",
          "executor: { resource: 'bq:project.dataset' }",
          "sources:\n  - { resource: acme.sales.orders }",
        ].join("\n"),
      ),
      "a/c.sql": undefined,
      "refs/run.md": concept(),
    }
    expect(await only("okf/broken-link", at("0.3", files))).toEqual([
      "a/b.md:5:1 warning okf/broken-link `refs/run.md` does not exist from this concept's folder, where OKF 0.3 resolves a path without a leading `/`; from the tree's root, write `/refs/run.md`.",
      "a/b.md:7:1 warning okf/broken-link `gone.md` does not exist in this tree.",
    ])
    // Under 0.2 a bare path may be from the tree's root (§12.1): not checked.
    expect(await only("okf/broken-link", at("0.2", files))).toEqual([])
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

  it("accepts underscores, as a table's name has them, and suggests keeping them", async () => {
    const files: Record<string, string> = { "index.md": '---\nokf_version: "0.3"\n---\n' }
    for (const name of ["n_day_active_users", "events_", "monthly-churn", "q3_2026-plan", "2026"]) {
      files[`tables/${name}.md`] = concept()
    }
    files["crypto_bitcoin/blocks.md"] = concept()
    expect(await only("okforest/slug", files)).toEqual([])
    expect(
      await only("okforest/slug", { "Daily_Users.md": concept(), "_draft.md": concept() }),
    ).toEqual([
      "Daily_Users.md:-:- warning okforest/slug File name `Daily_Users` is not a slug: use lowercase letters, digits, hyphens, and underscores (e.g. `daily_users`).",
      "_draft.md:-:- warning okforest/slug File name `_draft` is not a slug: use lowercase letters, digits, hyphens, and underscores (e.g. `draft`).",
    ])
  })

  it("does not suggest the same name back", async () => {
    expect(await only("okforest/slug", { "-.md": concept() })).toEqual([
      "-.md:-:- warning okforest/slug File name `-` is not a slug: use lowercase letters, digits, hyphens, and underscores.",
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

  it("checks what draws Mermaid diagrams", async () => {
    expect(await settings("diagrams:\n  mermaid:\n    renderer: pele\n")).toEqual([])
    expect(await settings("diagrams: {}\n")).toEqual([])
    expect(await settings("diagrams:\n  mermaid:\n    renderer: graphviz\n")).toEqual([
      ".okforest/settings.yaml:3:5 error okforest/settings `diagrams.mermaid.renderer` must be `mermaid` or `pele` (got `graphviz`).",
    ])
    expect(await settings("diagrams:\n  mermaid:\n    renderer: 3\n")).toEqual([
      ".okforest/settings.yaml:3:5 error okforest/settings `diagrams.mermaid.renderer` must be `mermaid` or `pele` (got a number).",
    ])
    expect(await settings("diagrams:\n  mermaid: pele\n")).toEqual([
      ".okforest/settings.yaml:2:3 error okforest/settings `diagrams.mermaid` must be a mapping of settings, such as `renderer: pele`.",
    ])
    expect(await settings("diagrams: pele\n")).toEqual([
      ".okforest/settings.yaml:1:1 error okforest/settings `diagrams` must be a mapping of diagram languages, such as `mermaid`.",
    ])
    // Reported where it's written: at the anchor an alias points to.
    expect(
      await settings(
        "x-shared: &diagrams\n  mermaid:\n    renderer: graphviz\ndiagrams: *diagrams\n",
      ),
    ).toEqual([
      ".okforest/settings.yaml:3:5 error okforest/settings `diagrams.mermaid.renderer` must be `mermaid` or `pele` (got `graphviz`).",
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
    expect(await keys("diagrams:\n  mermaid:\n    renderer: pele\n")).toEqual([])
  })

  it("checks the settings within sections", async () => {
    expect(
      await keys("diagrams:\n  mermaid:\n    rendrer: pele\n  d2:\n    layout: elk\n"),
    ).toEqual([
      ".okforest/settings.yaml:3:5 warning okforest/settings-keys Unknown setting `diagrams.mermaid.rendrer`: did you mean `renderer`? Unknown settings are ignored.",
      ".okforest/settings.yaml:4:3 warning okforest/settings-keys Unknown setting `diagrams.d2`, ignored. The settings in `diagrams` are `mermaid`.",
    ])
    // A section that isn't a mapping is okforest/settings' to report.
    expect(await keys("diagrams: pele\n")).toEqual([])
  })

  it("reports a setting where it's written", async () => {
    expect(
      await keys("x-shared: &mermaid\n  rendrer: pele\ndiagrams:\n  mermaid: *mermaid\n"),
    ).toEqual([
      ".okforest/settings.yaml:1:1 warning okforest/settings-keys Unknown setting `x-shared`, ignored. The settings are `name`, `description`, `ignore`, `diagrams`.",
      ".okforest/settings.yaml:2:3 warning okforest/settings-keys Unknown setting `diagrams.mermaid.rendrer`: did you mean `renderer`? Unknown settings are ignored.",
    ])
    expect(await keys("name: n\n2026: launch\n")).toEqual([
      ".okforest/settings.yaml:2:1 warning okforest/settings-keys Unknown setting `2026`, ignored. The settings are `name`, `description`, `ignore`, `diagrams`.",
    ])
  })

  it("reports a key that isn't text at the file's start", async () => {
    // YAML warns that it reads the key `[a, b]` as text.
    const warning = vi.spyOn(process, "emitWarning").mockImplementation(() => {})
    try {
      expect(await keys("name: n\n? [a, b]\n: x\n")).toEqual([
        ".okforest/settings.yaml:1:1 warning okforest/settings-keys Unknown setting `[ a, b ]`, ignored. The settings are `name`, `description`, `ignore`, `diagrams`.",
      ])
    } finally {
      warning.mockRestore()
    }
  })

  it("names a likely misspelling, and lists the settings otherwise", async () => {
    expect(await keys("nmae: Sales\ncolor: green\n")).toEqual([
      ".okforest/settings.yaml:1:1 warning okforest/settings-keys Unknown setting `nmae`: did you mean `name`? Unknown settings are ignored.",
      ".okforest/settings.yaml:2:1 warning okforest/settings-keys Unknown setting `color`, ignored. The settings are `name`, `description`, `ignore`, `diagrams`.",
    ])
  })
})

describe("okforest/similar-type", () => {
  const typed = (type: string) =>
    `---\ntype: ${type}\ntitle: Example\ndescription: An example.\n---\n`
  const schema = (title: string) => JSON.stringify({ title, type: "object" })

  it("points at the type with a schema, however many concepts use the other", async () => {
    expect(
      await only("okforest/similar-type", {
        "a.md": typed("metric"),
        "b.md": typed("metric"),
        "c.md": typed("Metric"),
        ".okforest/types/metric.schema.json": schema("Metric"),
      }),
    ).toEqual([
      "a.md:2:1 warning okforest/similar-type Type `metric` (2 concepts) looks like `Metric` (1 concept and a schema): did you mean `Metric`?",
      "b.md:2:1 warning okforest/similar-type Type `metric` (2 concepts) looks like `Metric` (1 concept and a schema): did you mean `Metric`?",
    ])
  })

  it("never reports a type that has a schema", async () => {
    expect(
      await only("okforest/similar-type", {
        "a.md": typed("Policy"),
        "b.md": typed("Policies"),
        ".okforest/types/policy.schema.json": schema("Policy"),
        ".okforest/types/policies.schema.json": schema("Policies"),
      }),
    ).toEqual([])
  })

  it("catches two letters swapped", async () => {
    expect(
      await only("okforest/similar-type", {
        "a.md": typed("Metric"),
        "b.md": typed("Metric"),
        "c.md": typed("Metirc"),
      }),
    ).toEqual([
      "c.md:2:1 warning okforest/similar-type Type `Metirc` (1 concept) looks like `Metric` (2 concepts): did you mean `Metric`?",
    ])
  })

  it("says nothing when no type is clearly the one meant", async () => {
    expect(
      await only("okforest/similar-type", { "a.md": typed("Metric"), "b.md": typed("Metrc") }),
    ).toEqual([])
  })

  it("leaves types that differ by a number alone", async () => {
    expect(
      await only("okforest/similar-type", {
        "a.md": typed("Plan 2025"),
        "b.md": typed("Plan 2025"),
        "c.md": typed("Plan 2026"),
      }),
    ).toEqual([])
  })
})

describe("okforest/similar-tag", () => {
  it("reports a tag at each concept that uses it, once", async () => {
    expect(
      await only("okforest/similar-tag", {
        "a.md": concept("tags: [finance]"),
        "b.md": concept("tags: [finance]"),
        "c.md": concept("tags: [Finance, Finance]"),
      }),
    ).toEqual([
      "c.md:5:8 warning okforest/similar-tag Tag `Finance` (1 concept) looks like `finance` (2 concepts): did you mean `finance`?",
    ])
  })
})
