# OKForest CLI

[![npm — okforest](https://img.shields.io/npm/v/okforest?label=okforest)](https://www.npmjs.com/package/okforest)
[![npm — @okforest/validate](https://img.shields.io/npm/v/%40okforest%2Fvalidate?label=%40okforest%2Fvalidate)](https://www.npmjs.com/package/@okforest/validate)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)
[![CI](https://github.com/okforest/cli/actions/workflows/ci.yaml/badge.svg)](https://github.com/okforest/cli/actions/workflows/ci.yaml)
[![Coverage](https://codecov.io/gh/okforest/cli/graph/badge.svg)](https://codecov.io/gh/okforest/cli)

Validate, inventory, and scaffold [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/open-knowledge-format)
v0.2 trees. Deterministic: no model calls, no network, the same results on
every machine, and the same code that runs inside [OKForest](https://www.okforest.ai).

```sh
npx okforest validate .
```

It needs Node.js 22 or later. `npx` runs it without installing anything; to
run `okforest` directly, `npm install --global okforest`, or in a repository
`npm install --save-dev okforest`, so everyone and CI run the same version.

| Package                                   | What it is                                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`okforest`](packages/okforest)           | The CLI: `validate`, `rule`, `inventory`, and `init`.                                                                                               |
| [`@okforest/validate`](packages/validate) | The validation rules, as a library with structured findings.                                                                                        |
| [`@okforest/okf`](packages/okf)           | Read an OKF tree into a model: concepts, links, backlinks, trust tiers, staleness, and the metadata inventory. Runs in Node, browsers, and Workers. |

## Commands

**`okforest validate [path] [--format text|json]`** checks a tree against the
OKF v0.2 specification and OKForest conventions. It exits 1 when there are
errors; warnings and info never fail, so a conformant bundle with, say,
broken links still passes (the spec says never to reject a bundle for those).
`--format json` writes a versioned document for CI and tools. Each finding
names its rule, and every rule has a page explaining it at
`https://www.okforest.ai/docs/rules/<rule id>/`; the text output ends with
those links for the rules that reported something, and `okforest rule <rule
id>` explains one in the terminal.

**`okforest inventory [path] [--format text|json]`** lists every type, tag, and
frontmatter key in use, with counts, lifecycle and trust totals, and likely
near-duplicates (`e-commerce` and `ecommerce`, `Policy` and `Policies`).

**`okforest init [path] --template company`** creates a new tree: a root
`index.md` declaring `okf_version: "0.2"`, `log.md`, `.okforest/settings.yaml`
with the bundle's `name` (`--name`, defaulting to the folder's name), draft
starter concepts, and a GitHub workflow that validates every pull request with
the OKForest Validate action.

**`okforest rule [rule] [--format text|json]`** explains a rule: why it exists,
an example that breaks it, what `okforest validate` reports for it, and the
fix, the same as its page on the web, offline. `okforest rule okf/type`, for
example; with no rule, it lists them all. A coding agent that runs `okforest
validate` can run it to learn how to fix what it found; `--format json` gives
the same as data.

**`okforest types init [path] [--type <type>]... [--dry-run]`** drafts a
[type schema](#type-schemas) for each type in use that has none, from what its
concepts hold: each field beyond OKF's, typed by its values, with a format,
allowed values, or `required` where every concept agrees, so they all match
it. It never overwrites a file; `--dry-run` prints the drafts instead.

### Diagram checks

D2 and Mermaid syntax checks (`d2` and `mermaid` code blocks) use
optional packages, about 200 MB together, so the CLI stays small without them.
Install them alongside `okforest` to enable the checks:

```sh
npx -p okforest -p @d2lang/d2 -p mermaid okforest validate .
```

Without them, diagram blocks are reported as not checked (`info`). Some
Mermaid diagram types (pie, gitGraph, and others) need a browser to parse and
are also reported as not checked.

### In GitHub Actions

[OKForest Validate](https://github.com/okforest/validate-action) runs the same
rules on every pull request, annotates each finding on its file and line, and
lists them all in the job summary. It includes the diagram checks; there is
nothing to install.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: okforest/validate-action@v1
```

## Rules

Errors are what the OKF v0.2 specification requires; warnings and info are
what it recommends, plus OKForest conventions. Each rule's page on the site
([www.okforest.ai/docs/rules](https://www.okforest.ai/docs/rules/)) explains
it in more detail.


**OKF v0.2 specification**

| Rule                       | Severity | Checks                                                                                                                                                                                   |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `okf/frontmatter`          | error    | Every concept starts with a parseable YAML frontmatter block (OKF §4, §11).                                                                                                              |
| `okf/type`                 | error    | Every concept's frontmatter has a non-empty string `type` (OKF §4.1, §11).                                                                                                               |
| `okf/index-frontmatter`    | error    | index.md files carry no frontmatter, except an `okf_version` key in the bundle-root index.md (OKF §8, §12).                                                                              |
| `okf/index-entries`        | warning  | index.md lists its directory as `* [Title](path) - description` entries under headings (OKF §8).                                                                                         |
| `okf/log-date`             | error    | log.md groups entries under second-level headings in ISO 8601 `YYYY-MM-DD` form (OKF §9).                                                                                                |
| `okf/log-order`            | warning  | log.md lists its dates newest first, each once (OKF §9).                                                                                                                                 |
| `okf/okf-version`          | info     | The bundle-root index.md declares `okf_version: "0.2"` (OKF §12).                                                                                                                        |
| `okf/generated`            | error    | `generated` is a mapping with a required `by` actor (OKF §5.2).                                                                                                                          |
| `okf/verified`             | error    | `verified` is a `{ by, at }` mapping or a list of them (OKF §5.2).                                                                                                                       |
| `okf/sources`              | error    | `sources` is a list of mappings, each with a `resource`, unique `id`s, and well-formed credibility signals (OKF §5.1).                                                                   |
| `okf/status`               | error    | `status` is one of `draft`, `stable`, or `deprecated` (OKF §5.4).                                                                                                                        |
| `okf/datetime`             | error    | Timestamps are ISO 8601 datetimes with an explicit UTC offset, e.g. `2026-06-30T14:00:00Z` (OKF §5).                                                                                     |
| `okf/attested-computation` | error    | An Attested Computation has a `runtime`, well-formed `parameters`, `executor`, and `attester`, and a computation (a `computation` path or a code block under `# Computation`) (OKF §10). |
| `okf/title`                | warning  | Concepts have a `title` (recommended, OKF §4.1).                                                                                                                                         |
| `okf/description`          | warning  | Concepts have a one-sentence `description` (recommended, OKF §4.1).                                                                                                                      |
| `okf/field-types`          | warning  | `title`, `description`, and `resource` are strings, and `tags` is a list of strings (OKF §4.1).                                                                                          |
| `okf/actor`                | warning  | `generated.by` and `verified[].by` follow the actor convention: `<producer>/<version>`, `human:<id>`, or `process:<id>` (OKF §7).                                                        |
| `okf/broken-link`          | warning  | Links within the tree point at files that exist (a warning: OKF says never reject a bundle for broken links, §6.1, §11).                                                                 |
| `okf/footnote-source`      | warning  | In a concept that has `sources` with `id`s, every footnote label matches one of them (OKF §5.1 per-claim attribution).                                                                   |
| `okf/legacy-v01`           | info     | Flags OKF v0.1 conventions superseded in v0.2: `timestamp` and a body `# Citations` list (OKF §13).                                                                                      |

**OKForest conventions**

| Rule                         | Severity | Checks                                                                                                                                                        |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `okforest/settings`          | error    | `.okforest/settings.yaml` (spelled `.yaml`) holds well-formed settings: a `name` of up to 100 characters, a `description` of up to 4,000, and `ignore` globs. |
| `okforest/settings-keys`     | warning  | `.okforest/settings.yaml` uses only the settings OKForest knows; others, such as a misspelled key, are ignored.                                               |
| `okforest/type-schema`       | error    | Concepts match their type's JSON Schema in `.okforest/types/`, and each schema there is a usable JSON Schema for one type.                                    |
| `okforest/slug`              | warning  | File and directory names of concepts are slugs: lowercase letters, digits, and hyphens.                                                                       |
| `okforest/placeholder`       | warning  | Bodies contain no unrendered template placeholders (`{{name}}`, `<concept>`, `[INSERT ...]`) or example link paths (`path/to/...`).                           |
| `okforest/wikilink`          | warning  | Concepts link with standard markdown links, not `[[wikilinks]]` (OKF §6.1).                                                                                   |
| `okforest/d2-syntax`         | error    | `d2` code blocks are valid D2 (diagrams as code).                                                                                                             |
| `okforest/mermaid-syntax`    | error    | `mermaid` code blocks are valid Mermaid (diagrams as code).                                                                                                   |
| `okforest/diagram-unchecked` | info     | Reports diagram blocks whose syntax could not be checked (tool not installed or unsupported here).                                                            |

## What counts as a concept

Every `.md` file is a concept except `index.md` and `log.md` (reserved by OKF)
and files under `.okforest/` and `.git/`, as the OKF specification says. That
includes repository files such as `README.md` and files under `.github/`. Leave
out the ones that are not concepts with `ignore:` globs in
`.okforest/settings.yaml`:

```yaml
ignore:
  - README.md
  - FOLLOWUPS.md
  - drafts/
```

Every setting in `.okforest/settings.yaml` is optional, and each is described in
[Settings](https://www.okforest.ai/docs/settings/). For completion and checks
while you edit the file, it can start with a
[JSON Schema](https://www.okforest.ai/schemas/settings.schema.json) comment,
which editors with the YAML language server (VS Code's YAML extension, and
others) read; `okforest init` writes it:

```yaml
# yaml-language-server: $schema=https://www.okforest.ai/schemas/settings.schema.json
```

The schema ships in `@okforest/validate` too
(`@okforest/validate/settings.schema.json`), and a test keeps it in step with
the `okforest/settings` and `okforest/settings-keys` rules.

## Type schemas

A type can have a [JSON Schema](https://json-schema.org/) for its concepts'
frontmatter in `.okforest/types/`, one `<type>.schema.json` file a type, and
every concept of that type must match it (the `okforest/type-schema` rule).
The schema's `title` is the type, as concepts write it in `type`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Customer",
  "description": "An organization that buys from us.",
  "type": "object",
  "properties": {
    "relationship": { "enum": ["prospect", "active", "former"] },
    "account_owner": { "type": "string", "format": "email" },
    "since": { "type": "string", "format": "date" }
  },
  "required": ["relationship"]
}
```

A schema lists only its type's own fields: OKF's (`title`, `tags`,
`verified`, ...) are checked by the `okf/*` rules, and left out of what a
schema checks unless it names them in `properties`, to narrow `tags`, say.
So `"additionalProperties": false` rejects fields the type doesn't have,
without rejecting OKF's. Editors check a `.schema.json` file against JSON
Schema itself as you write it. `okforest types init` drafts a schema for each
type from its concepts, to start from.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). Test fixtures include Google's OKF
sample bundles (Apache 2.0, see [fixtures/okf-samples/NOTICE](fixtures/okf-samples/NOTICE)).

OKF is an open specification published by Google; OKForest is independent and
not endorsed by Google.

Open source under [Apache-2.0](LICENSE) · © Preneur LLC · OKForest™ is a
trademark of Preneur LLC ([trademark policy](https://www.okforest.ai/trademarks/)).
