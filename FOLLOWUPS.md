# Follow-ups

The planning doc for this repository; move items to GitHub Issues as the
project matures.

## Next: Step 2, the OKForest Validate GitHub Action

- **`okforest/validate-action` repo:** a JavaScript action (`node24`) whose
  bundle in `dist/` is committed on main, so users write
  `uses: okforest/validate-action@v1`. It calls `@okforest/validate` directly:
  Mermaid bundled, D2 downloaded on demand (checksum-verified) through the
  `diagrams.d2` loader only when a tree has `d2` blocks. File and line
  annotations, a job summary, a `toReport()` JSON file as an output, and a
  configurable `fail-on`. Release with semantic version tags plus a moving
  `v1` tag.
- **Dogfood the action:** a `company-okf` workflow, and switch the `init`
  template's workflow to `uses: okforest/validate-action@v1`.
- **SARIF output** (`--format sarif`) so findings can also appear in GitHub
  code scanning.

## Release

- **Staged publishing before January 2027.** npm is restricting "direct
  publishing" in January 2027 and recommends staged publishing (CI uploads,
  a maintainer approves each package with 2FA). Check whether the restriction
  covers OIDC trusted publishing; if so, switch `release.yml` to pack with
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
  `okf/broken-link` therefore only checks `/…`, `./…`, and `../…` forms. Raise
  the ambiguity upstream, then check bare paths once it is settled.
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
- **Rule documentation pages** at okforest.ai/docs, linked from each finding.

## Upstream

- **Google sample bundles:** `stackoverflow` writes `tags` as one
  comma-separated string in 8 concepts, and uses numeric footnotes (`[^1]`)
  next to `sources` ids; the three BigQuery bundles use underscores in file
  names. Worth small upstream PRs, as a good OKF community citizen.
- **mermaid's type declarations** import `type-fest` without declaring it, so
  `packages/validate` sets `skipLibCheck`; remove it when fixed upstream.
