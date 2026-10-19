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
  /** The same file, fixed: the tree then has no findings at all. */
  fixed: string
  /** The tree's other files, not shown (its index, a linked concept). */
  context?: Readonly<Record<string, string>>
}

const SPEC = "https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md"

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
}
