/**
 * What each rule's documentation page shows beyond its one-sentence
 * description (https://www.okforest.ai/docs/rules/<rule id>/): why the rule
 * exists, and an example that breaks it, with what the validator reports and
 * the fix. test/rule-docs.test.ts runs every example, so a page can't show
 * one that has stopped being true.
 */
export interface RuleDocs {
  /** Why the rule exists, as Markdown, linking the specification sections it
   * enforces. */
  why: string
  example: RuleExample
}

/** A small tree that breaks a rule, shown as one of its files. */
export interface RuleExample {
  /** The file shown, bundle-relative. */
  file: string
  /** The file's text, breaking the rule. */
  fails: string
  /** What the validator reports for it, one line per finding:
   * `<line>:<column> <message>`. */
  findings: readonly string[]
  /** The same file, fixed: the tree then has no findings at all. Absent for
   * a note with nothing to fix; its `why` says what to do instead. */
  fixed?: string
  /** Where the fixed file lives, when fixing it means renaming it. */
  fixedFile?: string
  /** The tree's other files, not shown (its index, a linked concept). */
  context?: Readonly<Record<string, string>>
}

const SPEC = "https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md"
const SITE = "https://www.okforest.ai"

const CHURN_BODY =
  "Churn is the customers who cancel in a month, divided by the customers at its start."

/** The example concept, with extra frontmatter lines and a body. */
const churn = (extra = "", body = CHURN_BODY) => `---
type: Metric
title: Monthly churn
description: The share of customers who cancel in a month.
${extra}---

${body}
`

const rootIndex = (entries: string) => `---
okf_version: "0.2"
---

# Metrics

${entries}
`

const CHURN_ENTRY = "* [Monthly churn](churn.md) - The share of customers who cancel in a month."

/** The rules documented so far, by ID. */
export const ruleDocs: Readonly<Record<string, RuleDocs>> = {
  "okf/type": {
    why: `OKF requires one key in every concept's frontmatter: \`type\`, a short string naming the kind of concept, such as \`Metric\` or \`Playbook\`. Consumers use it to route, filter, and present concepts, and a bundle is conformant only if every concept has a non-empty \`type\` ([§4.1](${SPEC}#41-frontmatter), [§11](${SPEC}#11-conformance)). Types aren't registered anywhere: pick one that describes the concept, and use it consistently.`,
    example: {
      file: "churn.md",
      fails: `---
title: Monthly churn
description: The share of customers who cancel in a month.
---

Churn is the customers who cancel in a month, divided by the customers at its start.
`,
      findings: ["1:1 Missing `type`, the one required key."],
      fixed: `---
type: Metric
title: Monthly churn
description: The share of customers who cancel in a month.
---

Churn is the customers who cancel in a month, divided by the customers at its start.
`,
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/title": {
    why: `A \`title\` is recommended, not required. Without one, consumers make a name from the file name ([§4.1](${SPEC}#41-frontmatter)), so \`churn.md\` appears as "churn" in lists, search results, and AI assistants' citations. A title is how people and agents recognize a concept.`,
    example: {
      file: "churn.md",
      fails: `---
type: Metric
description: The share of customers who cancel in a month.
---

Churn is the customers who cancel in a month, divided by the customers at its start.
`,
      findings: ["1:1 No `title`: consumers will fall back to the file name."],
      fixed: `---
type: Metric
title: Monthly churn
description: The share of customers who cancel in a month.
---

Churn is the customers who cancel in a month, divided by the customers at its start.
`,
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/broken-link": {
    why: `Concepts link to each other with ordinary markdown links: bundle-relative, like \`/tables/customers.md\` (recommended, as it survives moving the linking file), or relative, like \`./other.md\` ([§6.1](${SPEC}#61-links-between-concepts)). OKF says a broken link isn't malformed, since it may point at knowledge not written yet, and consumers must not reject a bundle for one ([§11](${SPEC}#11-conformance)). So this is a warning: it finds links to files that don't exist, and links that climb out of the tree.`,
    example: {
      file: "churn.md",
      fails: `---
type: Metric
title: Monthly churn
description: The share of customers who cancel in a month.
---

Churn counts the cancellations in the [customer table](/tables/customer.md).
`,
      findings: [
        "7:39 `/tables/customer.md` does not exist in this tree (looked for `tables/customer.md`).",
      ],
      fixed: `---
type: Metric
title: Monthly churn
description: The share of customers who cancel in a month.
---

Churn counts the cancellations in the [customer table](/tables/customers.md).
`,
      context: {
        "index.md": rootIndex(
          `${CHURN_ENTRY}\n* [Customers](tables/customers.md) - One row per customer.`,
        ),
        "tables/customers.md": `---
type: Table
title: Customers
description: One row per customer.
---

One row per customer, with the date they joined and the date they cancelled.
`,
      },
    },
  },

  "okf/index-entries": {
    why: `An \`index.md\` lists what its directory holds, so a person or agent can see what's there before opening anything ([§8](${SPEC}#8-index-files)). Each entry is a list item that starts with a link, followed by a short description, usually the linked concept's own \`description\`: \`* [Title](path) - description\`. Entries in that shape are what consumers and index generators can read.`,
    example: {
      file: "index.md",
      fails: rootIndex("* Monthly churn: the share of customers who cancel in a month (churn.md)"),
      findings: ["7:1 Index entries should start with a link: `* [Title](path) - description`."],
      fixed: rootIndex(CHURN_ENTRY),
      context: {
        "churn.md": `---
type: Metric
title: Monthly churn
description: The share of customers who cancel in a month.
---

Churn is the customers who cancel in a month, divided by the customers at its start.
`,
      },
    },
  },

  "okf/verified": {
    why: `\`verified\` records who confirmed a concept against its sources, and when, so readers can tell checked knowledge from unchecked ([§5.2](${SPEC}#52-trust-generated-and-verified)). Each verification is a mapping with \`by\`, an actor such as \`human:jane@acme.example\`, and \`at\`, an ISO 8601 datetime; several verifications are a list of them. A malformed \`verified\` can't be trusted, so it is an error.`,
    example: {
      file: "churn.md",
      fails: `---
type: Metric
title: Monthly churn
description: The share of customers who cancel in a month.
verified: Jane checked this on September 1
---

Churn is the customers who cancel in a month, divided by the customers at its start.
`,
      findings: ["5:1 `verified` must be a `{ by, at }` mapping or a list of them."],
      fixed: `---
type: Metric
title: Monthly churn
description: The share of customers who cancel in a month.
verified: { by: human:jane@acme.example, at: 2026-09-01T00:00:00Z }
---

Churn is the customers who cancel in a month, divided by the customers at its start.
`,
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/frontmatter": {
    why: `Every concept is a markdown file that starts with YAML frontmatter between two \`---\` lines, followed by its markdown body ([§4](${SPEC}#4-concept-documents)). A bundle is conformant only if every file other than \`index.md\` and \`log.md\` has frontmatter that parses ([§11](${SPEC}#11-conformance)): it's where the concept's \`type\`, title, and trust signals live. A markdown file that isn't a concept, such as a README, can be left out with [\`ignore:\`](${SITE}/docs/settings/#files-that-are-not-concepts) in \`.okforest/settings.yaml\`.`,
    example: {
      file: "churn.md",
      fails: `# Monthly churn

${CHURN_BODY}
`,
      findings: [
        "1:1 No frontmatter: a concept must start with a `---` YAML block declaring at least `type`. If this is not a concept, add it to `ignore:` in .okforest/settings.yaml.",
      ],
      fixed: churn(),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/index-frontmatter": {
    why: `An \`index.md\` is a list of what its directory holds, not a concept, so it carries no frontmatter ([§8](${SPEC}#8-index-files)). The one exception is the bundle-root \`index.md\`, which may declare the OKF version the bundle targets, and nothing else ([§12](${SPEC}#12-versioning)).`,
    example: {
      file: "index.md",
      fails: `---
okf_version: "0.2"
title: Metrics
---

# Metrics

${CHURN_ENTRY}
`,
      findings: [
        "3:1 The root index.md frontmatter may only declare `okf_version`; remove `title`.",
      ],
      fixed: rootIndex(CHURN_ENTRY),
      context: { "churn.md": churn() },
    },
  },

  "okf/log-date": {
    why: `A \`log.md\` records the history of changes to its directory, as entries grouped under a heading for each date, newest first. The date headings must be ISO 8601 \`YYYY-MM-DD\` dates ([§9](${SPEC}#9-log-files)), so people and tools can read, sort, and compare them the same way everywhere.`,
    example: {
      file: "log.md",
      fails: `# Change log

## May 22, 2026

* **Creation**: Defined [Monthly churn](/churn.md).
`,
      findings: [
        "3:1 Log date headings must be ISO 8601 dates such as `## 2026-05-22` (got `May 22, 2026`).",
      ],
      fixed: `# Change log

## 2026-05-22

* **Creation**: Defined [Monthly churn](/churn.md).
`,
      context: { "index.md": rootIndex(CHURN_ENTRY), "churn.md": churn() },
    },
  },

  "okf/log-order": {
    why: `A \`log.md\` lists its dates newest first, each date once, with all of that day's entries under it ([§9](${SPEC}#9-log-files)): the latest change is the first thing a reader or agent sees.`,
    example: {
      file: "log.md",
      fails: `# Change log

## 2026-05-22

* **Creation**: Defined [Monthly churn](/churn.md).

## 2026-06-10

* **Update**: Churn now excludes free trials.
`,
      findings: ["7:1 2026-06-10 comes after 2026-05-22; list dates newest first."],
      fixed: `# Change log

## 2026-06-10

* **Update**: Churn now excludes free trials.

## 2026-05-22

* **Creation**: Defined [Monthly churn](/churn.md).
`,
      context: { "index.md": rootIndex(CHURN_ENTRY), "churn.md": churn() },
    },
  },

  "okf/okf-version": {
    why: `A bundle may declare the OKF version it targets, with \`okf_version: "0.2"\` in the frontmatter of its root \`index.md\`, the one place an index may have frontmatter ([§12](${SPEC}#12-versioning)). It's optional, so this is only a note, but it tells consumers which rules the bundle was written to.`,
    example: {
      file: "index.md",
      fails: `# Metrics

${CHURN_ENTRY}
`,
      findings: [
        '1:1 Declare the OKF version this bundle targets: frontmatter `okf_version: "0.2"`.',
      ],
      fixed: rootIndex(CHURN_ENTRY),
      context: { "churn.md": churn() },
    },
  },

  "okf/generated": {
    why: `\`generated\` records how a concept's current content was produced: \`by\`, the actor that wrote it (required), and \`at\`, when it last changed meaningfully ([§5.2](${SPEC}#52-trust-generated-and-verified)). It lets readers tell knowledge an AI drafted from knowledge a person wrote, and a recent edit from an old one, so it must be a mapping, not prose.`,
    example: {
      file: "churn.md",
      fails: churn("generated: Drafted by our metrics agent in June\n"),
      findings: [
        "5:1 `generated` must be a mapping: `generated: { by: <actor>, at: <datetime> }`.",
      ],
      fixed: churn("generated: { by: acme-metrics-agent/1.4, at: 2026-06-20T22:53:05Z }\n"),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/sources": {
    why: `\`sources\` records the materials a concept was derived from ([§5.1](${SPEC}#51-provenance-sources)). Each entry is a mapping with a \`resource\` (a URL, a path in the bundle, or a description of a scope, such as all the queries in a project) and, when the body cites it, an \`id\` that footnotes use. Optional signals (\`author\`, \`usage_count\`, \`last_modified\`) let readers judge how far to trust a source.`,
    example: {
      file: "churn.md",
      fails: churn(`sources:
  - title: Billing system cancellations export
`),
      findings: ["6:5 A source needs `resource`: a URL, a bundle path, or a scope descriptor."],
      fixed: churn(`sources:
  - id: billing
    resource: https://billing.acme.example/exports/cancellations
    title: Billing system cancellations export
`),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/status": {
    why: `\`status\` says where a concept is in its life: \`draft\` (not reviewed yet, possibly incomplete), \`stable\` (ready to use, and the default), or \`deprecated\` (kept for links and history, no longer current) ([§5.4](${SPEC}#54-lifecycle-status)). Consumers act on these three values, such as warning that an answer rests on a draft, so any other value can't be understood.`,
    example: {
      file: "churn.md",
      fails: churn("status: published\n"),
      findings: ["5:1 `status` must be `draft`, `stable`, or `deprecated`; got `published`."],
      fixed: churn("status: stable\n"),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/datetime": {
    why: `OKF's timestamps (\`generated.at\`, \`verified.at\`, \`stale_after\`, and the sources' \`last_modified\` and \`usage_window\`) are ISO 8601 datetimes ([§5](${SPEC}#5-provenance-trust-and-lifecycle)). With an explicit UTC offset, such as \`Z\`, an instant means the same everywhere, and whether a concept is stale is a plain comparison ([§5.5](${SPEC}#55-lifecycle-stale_after)). A date alone, or a time with no offset, depends on where it's read.`,
    example: {
      file: "churn.md",
      fails: churn("stale_after: 2026-12-31\n"),
      findings: [
        "5:1 `stale_after` must be an ISO 8601 datetime with an explicit UTC offset, such as `2026-12-31T00:00:00Z` (got `2026-12-31`).",
      ],
      fixed: churn("stale_after: 2026-12-31T00:00:00Z\n"),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/attested-computation": {
    why: `An Attested Computation carries a sanctioned way to compute a value, so a consumer can confirm an agent ran it rather than improvising its own ([§10](${SPEC}#10-attested-computations-concept)). Its contract is in the frontmatter ([§10.2](${SPEC}#102-contract-fields)): \`runtime\` (required: it defines what \`parameters\` mean), the \`parameters\` an agent may fill (\`{ name, type, required }\`), an \`executor\` that runs the computation and returns a receipt, and an \`attester\` that checks the receipt. The computation itself is a code block under \`# Computation\`, or a file named by \`computation\`.`,
    example: {
      file: "revenue.md",
      fails: `---
type: Attested Computation
title: Revenue for a fiscal year
description: Recognized revenue for a fiscal year, per Finance's definition.
parameters:
  - { name: year, type: integer, required: true }
executor:
  resource: /references/run-on-bigquery.md
  receipt: [job_id, executed_sql, result]
attester:
  resource: /references/sql_equality.py
---

# Computation

\`\`\`sql
SELECT SUM(amount) AS revenue FROM finance.recognized_revenue WHERE fiscal_year = @year
\`\`\`
`,
      findings: ["2:1 An Attested Computation needs `runtime`, e.g. `runtime: bigquery`."],
      fixed: `---
type: Attested Computation
title: Revenue for a fiscal year
description: Recognized revenue for a fiscal year, per Finance's definition.
runtime: bigquery
parameters:
  - { name: year, type: integer, required: true }
executor:
  resource: /references/run-on-bigquery.md
  receipt: [job_id, executed_sql, result]
attester:
  resource: /references/sql_equality.py
---

# Computation

\`\`\`sql
SELECT SUM(amount) AS revenue FROM finance.recognized_revenue WHERE fiscal_year = @year
\`\`\`
`,
      context: {
        "index.md": `---
okf_version: "0.2"
---

# Computations

* [Revenue for a fiscal year](revenue.md) - Recognized revenue for a fiscal year, per Finance's definition.
`,
        "references/run-on-bigquery.md": `---
type: Skill
title: Run on BigQuery
description: How to run a computation on BigQuery and return a receipt.
---

Run the query as a BigQuery job, and return its job ID, the SQL it ran, and its result.
`,
        "references/sql_equality.py":
          "def attest(receipt, computation):\n    return receipt['executed_sql'] == computation\n",
      },
    },
  },

  "okf/description": {
    why: `A one-sentence \`description\` is recommended ([§4.1](${SPEC}#41-frontmatter)): index entries, search snippets, and previews use it, and it's what an AI assistant sees first when deciding whether a concept answers a question.`,
    example: {
      file: "churn.md",
      fails: `---
type: Metric
title: Monthly churn
---

${CHURN_BODY}
`,
      findings: ["1:1 No `description`: index entries, search snippets, and previews use it."],
      fixed: churn(),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/field-types": {
    why: `The recommended keys have expected shapes ([§4.1](${SPEC}#41-frontmatter)): \`title\`, \`description\`, and \`resource\` are strings, and \`tags\` is a list of short strings. Consumers filter and display by them, so a single tag written as plain text, or a number where a title belongs, is read wrongly or not at all.`,
    example: {
      file: "churn.md",
      fails: churn("tags: billing\n"),
      findings: ["5:1 `tags` should be a list, e.g. `tags: [billing]`."],
      fixed: churn("tags: [billing, retention]\n"),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/actor": {
    why: `The fields that record who did something (\`generated.by\` and \`verified[].by\`) use one actor convention ([§7](${SPEC}#7-actor-convention)): \`human:<id>\` for a person, \`process:<id>\` for an automated process, and \`<producer>/<version>\` for an agent or tool. Trust tiers key off the \`human:\` prefix ([§5.3](${SPEC}#53-trust-tiers)), so a person's confirmation counts as human-reviewed only when it's written that way.`,
    example: {
      file: "churn.md",
      fails: churn("verified: { by: Jane Smith, at: 2026-09-01T00:00:00Z }\n"),
      findings: [
        "5:13 `Jane Smith` is not an actor: use `human:<id>` for a person, `process:<id>` for an automated process, or `<producer>/<version>` for an agent or tool.",
      ],
      fixed: churn("verified: { by: human:jane@acme.example, at: 2026-09-01T00:00:00Z }\n"),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/footnote-source": {
    why: `To say where a specific claim comes from, a concept cites a source with a markdown footnote whose label is that source's \`id\` ([§5.1](${SPEC}#51-provenance-sources), per-claim attribution). The label is the key into \`sources\`, not a position in the list, so the citation survives agents reordering the list. A footnote whose label matches no \`id\` cites nothing.`,
    example: {
      file: "churn.md",
      fails: churn(
        `sources:
  - id: billing
    resource: https://billing.acme.example/exports/cancellations
`,
        `Churn counts the cancellations in the billing system's export.[^export]

[^export]: Billing system cancellations export`,
      ),
      findings: ["10:63 Footnote [^export] matches no `sources` id (`billing`)."],
      fixed: churn(
        `sources:
  - id: billing
    resource: https://billing.acme.example/exports/cancellations
`,
        `Churn counts the cancellations in the billing system's export.[^billing]

[^billing]: Billing system cancellations export`,
      ),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okf/legacy-v01": {
    why: `OKF v0.2 replaced two v0.1 conventions ([§13.1](${SPEC}#131-breaking-changes)): \`timestamp\` became \`generated: { by, at }\`, and a body \`# Citations\` list became \`sources\` in the frontmatter, cited with footnotes. Consumers may still read the old forms, so this is only a note: a sign the concept predates v0.2.`,
    example: {
      file: "churn.md",
      fails: churn("timestamp: 2026-06-01T00:00:00Z\n"),
      findings: [
        "5:1 `timestamp` is OKF v0.1: record the last change as `generated: { by, at }` instead.",
      ],
      fixed: churn("generated: { by: human:jane@acme.example, at: 2026-06-01T00:00:00Z }\n"),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okforest/settings": {
    why: `\`.okforest/settings.yaml\` holds a tree's settings for OKForest: a \`name\` and \`description\`, which OKForest shows for the tree, and \`ignore\` globs for markdown files that aren't concepts. The file and every setting in it are optional, but what's there must be well formed. Each setting, and the glob syntax, are in [Settings](${SITE}/docs/settings/).`,
    example: {
      file: ".okforest/settings.yaml",
      fails: `name: 42
description: What Acme's teams know about customers, billing, and retention.
`,
      findings: ["1:1 `name` must be text (got a number)."],
      fixed: `name: Acme knowledge
description: What Acme's teams know about customers, billing, and retention.
`,
      context: { "index.md": rootIndex(CHURN_ENTRY), "churn.md": churn() },
    },
  },

  "okforest/settings-keys": {
    why: `OKForest ignores settings it doesn't know, so a misspelled one is lost without a word. This warning catches it, and suggests the setting you probably meant. The settings are \`name\`, \`description\`, and \`ignore\` ([Settings](${SITE}/docs/settings/)).`,
    example: {
      file: ".okforest/settings.yaml",
      fails: `nmae: Acme knowledge
`,
      findings: ["1:1 Unknown setting `nmae`: did you mean `name`? Unknown settings are ignored."],
      fixed: `name: Acme knowledge
`,
      context: { "index.md": rootIndex(CHURN_ENTRY), "churn.md": churn() },
    },
  },

  "okforest/slug": {
    why: `A concept's ID is its path without \`.md\` (\`metrics/monthly-churn\`), and OKForest uses it in addresses and citations. Names made of lowercase letters, digits, and hyphens read the same everywhere: in URLs, without escaping; on file systems that ignore case; and when people and AI assistants type them.`,
    example: {
      file: "Churn_Rate.md",
      fails: `---
type: Metric
title: Churn rate
description: The yearly share of customers who cancel.
---

The churn rate is the customers who cancel in a year, divided by the customers at its start.
`,
      findings: [
        "-:- File name `Churn_Rate` is not a slug: use lowercase letters, digits, and hyphens (e.g. `churn-rate`).",
      ],
      fixed: `---
type: Metric
title: Churn rate
description: The yearly share of customers who cancel.
---

The churn rate is the customers who cancel in a year, divided by the customers at its start.
`,
      fixedFile: "churn-rate.md",
      context: { "index.md": rootIndex(CHURN_ENTRY), "churn.md": churn() },
    },
  },

  "okforest/placeholder": {
    why: `Templates and AI drafts leave placeholders behind: \`{{team_name}}\`, \`<concept>\`, \`[INSERT OWNER]\`, or example paths like \`path/to/guide.md\`. Left in a concept, they read as unfinished to people, and an AI assistant may repeat them as if they were facts.`,
    example: {
      file: "churn.md",
      fails: churn("", "Churn is reported to {{team_name}} every month."),
      findings: ["7:22 Unrendered template placeholder `{{team_name}}`."],
      fixed: churn("", "Churn is reported to the finance team every month."),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okforest/wikilink": {
    why: `\`[[Page name]]\` links come from note-taking tools, most often [Obsidian](https://obsidian.md/) (also Logseq, Foam, and wikis). They name a page without saying where it is, so GitHub, AI assistants, and other markdown tools can't follow them. OKF uses standard markdown links, with a path ([§6.1](${SPEC}#61-links-between-concepts)). In Obsidian, turn off **Settings → Files and links → Use [[Wikilinks]]** and set **New link format** to **Relative path to file**, so new links are standard ones. Avoid **Absolute path in vault**, which writes paths without a leading \`/\`, so they resolve from each file's own folder and break.`,
    example: {
      file: "churn.md",
      fails: churn("", "Churn counts the cancellations in [[Customers]]."),
      findings: [
        "7:35 `[[Customers]]` is a wikilink, not an OKF link: write `[Customers](customers.md)` with the concept's path.",
      ],
      fixed: churn("", "Churn counts the cancellations in [Customers](/customers.md)."),
      context: {
        "index.md": rootIndex(
          `${CHURN_ENTRY}\n* [Customers](customers.md) - One row per customer.`,
        ),
        "customers.md": `---
type: Table
title: Customers
description: One row per customer.
---

One row per customer, with the date they joined and the date they cancelled.
`,
      },
    },
  },

  "okforest/d2-syntax": {
    why: `[D2](https://d2lang.com/) is a language for writing diagrams as text, and OKForest draws \`d2\` code blocks as diagrams. This check compiles each one with D2's own compiler and reports the first syntax error, with its line; the [D2 tour](https://d2lang.com/tour/intro/) teaches the syntax. The CLI checks D2 only when \`@d2lang/d2\` is installed alongside it ([diagram checks](${SITE}/docs/cli/#diagram-checks)); otherwise the blocks are reported as [\`okforest/diagram-unchecked\`](${SITE}/docs/rules/okforest/diagram-unchecked/). The GitHub Action always checks them.`,
    example: {
      file: "churn.md",
      fails: churn(
        "",
        `How a cancellation reaches the churn report:

\`\`\`d2
billing -> warehouse: nightly export
warehouse -> {
\`\`\``,
      ),
      findings: [
        "11:1 D2 syntax error: connection missing destination",
        "11:14 D2 syntax error: maps must be terminated with }",
      ],
      fixed: churn(
        "",
        `How a cancellation reaches the churn report:

\`\`\`d2
billing -> warehouse: nightly export
warehouse -> report: monthly churn
\`\`\``,
      ),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okforest/mermaid-syntax": {
    why: `[Mermaid](https://mermaid.js.org/) is a language for writing diagrams as text, and OKForest draws \`mermaid\` code blocks as diagrams. This check parses each one with Mermaid's own parser and reports the first syntax error, with its line; the [syntax reference](https://mermaid.js.org/intro/syntax-reference.html) covers every diagram type. The CLI checks Mermaid only when \`mermaid\` is installed alongside it ([diagram checks](${SITE}/docs/cli/#diagram-checks)); the GitHub Action always checks it.`,
    example: {
      file: "churn.md",
      fails: churn(
        "",
        `How a cancellation reaches the churn report:

\`\`\`mermaid
flowchart LR
  billing --> warehouse
  warehouse -->
\`\`\``,
      ),
      findings: [
        "12:1 Mermaid syntax error: Parse error on line 4: Expecting 'AMP', 'COLON', 'PIPE', 'TESTSTR', ..., got 'EOF'",
      ],
      fixed: churn(
        "",
        `How a cancellation reaches the churn report:

\`\`\`mermaid
flowchart LR
  billing --> warehouse
  warehouse --> report
\`\`\``,
      ),
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },

  "okforest/diagram-unchecked": {
    why: `A diagram's syntax couldn't be checked here, so this is only a note: the diagram may be fine. It happens when the diagram tool isn't installed alongside the CLI (\`npx -p okforest -p @d2lang/d2 -p mermaid okforest validate .\` installs both; see [diagram checks](${SITE}/docs/cli/#diagram-checks)), or for the Mermaid diagram types whose parser needs a browser, such as pie charts and git graphs. There is nothing to fix: check those diagrams by viewing them.`,
    example: {
      file: "churn.md",
      fails: churn(
        "",
        `Why customers cancelled last quarter:

\`\`\`mermaid
pie title Reasons for cancelling
  "Price" : 42
  "Switched provider" : 31
  "No longer needed" : 27
\`\`\``,
      ),
      findings: [
        "9:1 Mermaid diagram not checked: Mermaid's parser for this diagram type needs a browser and cannot run here.",
      ],
      context: { "index.md": rootIndex(CHURN_ENTRY) },
    },
  },
}
