# OKForest CLI

[![npm — okforest](https://img.shields.io/npm/v/okforest?label=okforest)](https://www.npmjs.com/package/okforest)
[![npm — @okforest/validate](https://img.shields.io/npm/v/%40okforest%2Fvalidate?label=%40okforest%2Fvalidate)](https://www.npmjs.com/package/@okforest/validate)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)
[![CI](https://github.com/okforest/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/okforest/cli/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/okforest/cli/graph/badge.svg)](https://codecov.io/gh/okforest/cli)

Validate, inventory, and scaffold [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/open-knowledge-format)
v0.2 trees. Deterministic: no model calls, no network, the same results on
every machine, and the same code that runs inside [OKForest](https://www.okforest.ai).

```sh
npx okforest validate .
```

| Package | What it is |
|---|---|
| [`okforest`](packages/okforest) | The CLI: `validate`, `inventory`, and `init`. |
| [`@okforest/validate`](packages/validate) | The validation rules, as a library with structured findings. |
| [`@okforest/okf`](packages/okf) | Read an OKF tree into a model: concepts, links, backlinks, trust tiers, staleness, and the metadata inventory. Runs in Node, browsers, and Workers. |

## Commands

**`okforest validate [path] [--format text|json]`** checks a tree against the
OKF v0.2 specification and OKForest conventions. It exits 1 when there are
errors; warnings and info never fail, so a conformant bundle with, say,
broken links still passes (the spec says never to reject a bundle for those).
`--format json` writes a versioned document for CI and tools. Each finding
names its rule, and every rule has a page explaining it at
`https://www.okforest.ai/docs/rules/<rule id>/`; the text output ends with
those links for the rules that reported something.

**`okforest inventory [path] [--format text|json]`** lists every type, tag, and
frontmatter key in use, with counts, lifecycle and trust totals, and likely
near-duplicates (`e-commerce` and `ecommerce`, `Policy` and `Policies`).

**`okforest init [path] --template company`** creates a new tree: a root
`index.md` declaring `okf_version: "0.2"`, `log.md`, `.okforest/tree.yaml`
naming the Owner (`--owner`, defaulting to your git email), draft starter
concepts, and a GitHub workflow that validates every pull request with the
OKForest Validate action.

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

| Rule | Severity | Checks |
|---|---|---|
| `okf/frontmatter` | error | Every concept starts with a parseable YAML frontmatter block (OKF §4, §11). |
| `okf/type` | error | Every concept's frontmatter has a non-empty string `type` (OKF §4.1, §11). |
| `okf/index-frontmatter` | error | index.md files carry no frontmatter, except an `okf_version` key in the bundle-root index.md (OKF §8, §12). |
| `okf/index-entries` | warning | index.md lists its directory as `* [Title](path) - description` entries under headings (OKF §8). |
| `okf/log-date` | error | log.md groups entries under second-level headings in ISO 8601 `YYYY-MM-DD` form (OKF §9). |
| `okf/log-order` | warning | log.md lists its dates newest first, each once (OKF §9). |
| `okf/okf-version` | info | The bundle-root index.md declares `okf_version: "0.2"` (OKF §12). |
| `okf/generated` | error | `generated` is a mapping with a required `by` actor (OKF §5.2). |
| `okf/verified` | error | `verified` is a `{ by, at }` mapping or a list of them (OKF §5.2). |
| `okf/sources` | error | `sources` is a list of mappings, each with a `resource`, unique `id`s, and well-formed credibility signals (OKF §5.1). |
| `okf/status` | error | `status` is one of `draft`, `stable`, or `deprecated` (OKF §5.4). |
| `okf/datetime` | error | Timestamps are ISO 8601 datetimes with an explicit UTC offset, e.g. `2026-06-30T14:00:00Z` (OKF §5). |
| `okf/attested-computation` | error | An Attested Computation has a `runtime`, well-formed `parameters`, `executor`, and `attester`, and a computation (a `computation` path or a code block under `# Computation`) (OKF §10). |
| `okf/title` | warning | Concepts have a `title` (recommended, OKF §4.1). |
| `okf/description` | warning | Concepts have a one-sentence `description` (recommended, OKF §4.1). |
| `okf/field-types` | warning | `title`, `description`, and `resource` are strings, and `tags` is a list of strings (OKF §4.1). |
| `okf/actor` | warning | `generated.by` and `verified[].by` follow the actor convention: `<producer>/<version>`, `human:<id>`, or `process:<id>` (OKF §7). |
| `okf/broken-link` | warning | Links within the tree point at files that exist (a warning: OKF says never reject a bundle for broken links, §6.1, §11). |
| `okf/footnote-source` | warning | In a concept that has `sources` with `id`s, every footnote label matches one of them (OKF §5.1 per-claim attribution). |
| `okf/legacy-v01` | info | Flags OKF v0.1 conventions superseded in v0.2: `timestamp` and a body `# Citations` list (OKF §13). |

**OKForest conventions**

| Rule | Severity | Checks |
|---|---|---|
| `okforest/tree-yaml` | error | `.okforest/tree.yaml` (spelled `.yaml`) names exactly one Owner as `user:<id>`, Stewards as `user`/`group` entries, and well-formed optional settings. |
| `okforest/tree-yaml-keys` | warning | `.okforest/tree.yaml` uses only the settings OKForest knows; others, such as a misspelled key, are ignored. |
| `okforest/slug` | warning | File and directory names of concepts are slugs: lowercase letters, digits, and hyphens. |
| `okforest/placeholder` | warning | Bodies contain no unrendered template placeholders (`{{name}}`, `<concept>`, `[INSERT ...]`) or example link paths (`path/to/...`). |
| `okforest/wikilink` | warning | Concepts link with standard markdown links, not `[[wikilinks]]` (OKF §6.1). |
| `okforest/d2-syntax` | error | `d2` code blocks are valid D2 (diagrams as code). |
| `okforest/mermaid-syntax` | error | `mermaid` code blocks are valid Mermaid (diagrams as code). |
| `okforest/diagram-unchecked` | info | Reports diagram blocks whose syntax could not be checked (tool not installed or unsupported here). |

## What counts as a concept

Every `.md` file is a concept except `index.md` and `log.md` (reserved by
OKF), files under hidden directories (`.github/`, `.okforest/`), and these
repository files at the tree root: `README.md`, `LICENSE.md`,
`CONTRIBUTING.md`, `CHANGELOG.md`, `SECURITY.md`, and `CODE_OF_CONDUCT.md`.
Skip others with `ignore:` globs in `.okforest/tree.yaml`:

```yaml
ignore:
  - FOLLOWUPS.md
  - drafts/
```

Every setting in `.okforest/tree.yaml` is described in
[Tree settings](https://www.okforest.ai/docs/tree-settings/). For completion
and checks while you edit it, the file can start with a
[JSON Schema](https://www.okforest.ai/schemas/tree.schema.json) comment, which
editors with the YAML language server (VS Code's YAML extension, and others)
read; `okforest init` writes it:

```yaml
# yaml-language-server: $schema=https://www.okforest.ai/schemas/tree.schema.json
```

The schema ships in `@okforest/validate` too
(`@okforest/validate/tree.schema.json`), and a test keeps it in step with the
`okforest/tree-yaml` and `okforest/tree-yaml-keys` rules.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). Test fixtures include Google's OKF
sample bundles (Apache 2.0, see [fixtures/okf-samples/NOTICE](fixtures/okf-samples/NOTICE)).

OKF is an open specification published by Google; OKForest is independent and
not endorsed by Google.

Open source under [Apache-2.0](LICENSE) · © Preneur LLC · OKForest™ is a
trademark of Preneur LLC ([trademark policy](https://www.okforest.ai/trademarks/)).
