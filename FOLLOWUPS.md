# Follow-ups

The planning doc for this repository; move items to GitHub Issues as the
project matures. Deferred items, each with the trigger to re-evaluate it, are
already [issues](https://github.com/okforest/cli/issues): SARIF output (#9),
and removing `skipLibCheck` once mermaid declares `type-fest` (#10, blocked
upstream).

## Release

- **Staged publishing before January 2027.** npm is restricting "direct
  publishing" in January 2027 and recommends staged publishing (CI uploads,
  a maintainer approves each package with 2FA). Check whether the restriction
  covers OIDC trusted publishing; if so, switch CI's release job to pack with
  pnpm and `npm stage publish` the tarballs, and uncheck "Allow npm publish"
  on the three connections. Elicitly needs the same change.

## Validation

- **Remaining Mermaid diagram types.** `mermaid.parse()` runs in Node for
  flowcharts, sequence diagrams, and the other Jison-based types, but the
  Langium-based ones (pie, gitGraph, info, packet, architecture, radar,
  treemap) call DOMPurify and need a DOM, so they are reported as
  `okforest/diagram-unchecked`. Check them with `@mermaid-js/parser` directly
  (MIT, no DOM), or a minimal DOMPurify shim.
- **Bare path-valued fields.** OKF §6.2 says `resource`, `sources[].resource`,
  `computation`, `executor.resource`, and `attester.resource` may be relative
  paths, but Google's sample bundles write bundle-root paths without a leading
  slash (`executor.resource: skills/run-on-bq.md` from `computations/`).
  `okf/broken-link` therefore only checks `/…`, `./…`, and `../…` forms.
  Upstream [PR #31](https://github.com/GoogleCloudPlatform/open-knowledge-format/pull/31)
  (fixing issue #29) proposes the leading slash in the samples and spec
  examples; check bare paths once it is settled.
- **Rule configuration.** Per-tree severity overrides in
  `.okforest/tree.yaml` (the library already accepts `severity` overrides),
  plus CLI flags such as `--max-warnings` and `--rule <id>=off`.
- **Organization standards** as a third rule pack (`standards/*`): the type
  registry, required fields per type, tag vocabulary, and policies from
  `.okforest/` and a standards tree (Phase 2 in the brief). The `Rule`
  interface and `once()` resources are designed for it.
- **More checks from the brief:** a scan for secrets and personal data;
  binary images that should be diagrams as code; `index.md` entries that miss
  concepts in their directory (or list ones that don't exist); a `deprecated`
  concept linking to its successor.
- **Revisit strictness** if real-world trees trip it: duplicate YAML keys are
  errors (`okf/frontmatter`), and `okf/datetime` requires the `T` separator
  (RFC 3339 also allows a space).

## Performance

Measured with `pnpm bench` (400 copies of the stackoverflow sample: 10,400
concepts, 12,800 markdown files, 26.9 MB) on an Apple M5 Pro, single-threaded:
about 6 s, of which 5 s is markdown parsing and 0.3 s is all the rules. A
realistic tree of a few hundred concepts takes well under a second. Parsing
already uses CommonMark plus GFM footnotes only (1.5x faster than full GFM).
Options if a real tree ever needs more:

- **markdown-it** parses about 11x faster than micromark, but produces tokens
  rather than mdast (a breaking change to `@okforest/okf`'s `ast`) and gives
  line numbers only per block, so link and footnote columns would have to be
  reconstructed from the source.
- **Parallel parsing** with worker threads in `@okforest/okf/node` (the pure
  core is unchanged). Standard GitHub-hosted runners for private repositories
  have only 2 vCPUs (4 for public repositories) regardless of plan, so the
  gain is at most about 2x where most trees run, minus worker start-up.
  Revisit if GitHub upgrades the standard private runners, or if customers
  commonly use larger runners.

## CLI

- **`okforest index`**: generate or refresh `index.md` files from frontmatter
  (the brief's "index builder"), and append to `log.md`.
- **`okforest freshness`**: stale, draft, and unverified concepts (mirrors the
  MCP `freshness_report` tool).
- **More templates** for `init`: department trees (HR, Sales, Finance, IT) and
  product; a starter type registry once the standards format exists; `--force`
  for non-empty directories.

## Upstream

- **Google sample bundles:** `stackoverflow` writes `tags` as one
  comma-separated string in 8 concepts (reported as
  [issue #39](https://github.com/GoogleCloudPlatform/open-knowledge-format/issues/39)),
  and uses numeric footnotes (`[^1]`) next to `sources` ids (check the spec's
  wording before raising it). Underscores in the BigQuery bundles' file names
  break only OKForest's `okforest/slug` convention, not the spec.
