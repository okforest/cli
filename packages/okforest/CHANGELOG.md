# okforest

## 0.17.0

### Minor Changes

- d9d9b07: **Under OKF 0.3, a `.md` file without frontmatter or a `type` isn't read as a concept** (§3.2), so it's skipped as OKF says: a `README.md` is no longer counted, listed, or linked to as one. Trees on 0.2, or no version, read as before.
  
  - `@okforest/okf`: such a file is an `OtherMarkdown` (`kind: "other"`), in the new `Tree.otherMarkdown`, not `Tree.concepts`; `tree.concept(id)` and `backlinks` leave it out, and a link to it names no `concept`. `buildInventory` counts only concepts.
  - **Renamed, for the three kinds of markdown file**: `ReservedFile` (`index.md` and `log.md`) is now `ReservedMarkdown`, beside `Concept` and `OtherMarkdown`. Files that don't end in `.md` are assets (§3.2), which stay paths in `Tree.files`.
  - **For tools reading a tree a file at a time**: `TreeOutline.read` can now return an `OtherMarkdown` (its return type is `Concept | ReservedMarkdown | OtherMarkdown`), when `outlineTree` is given a root `index.md` declaring 0.3 (`{ okfVersion: declaredOkfVersion(text) }`). Skip it as a concept. A link read this way still names the concept its target's path would be, since whether that file is one isn't known until it's read.
  - `@okforest/validate`: `okf/not-a-concept` reports `OtherMarkdown`s, and the other rules check only concepts, so findings are unchanged; a validation's `concepts` count leaves them out. `checkFile` and `TreeChecker.check` take an `OtherMarkdown` too.
  
  **`okf/broken-link` checks bare path fields under OKF 0.3.** A `resource`, `computation`, `executor.resource`, `attester.resource`, or `superseded_by` without a leading `/` resolves from the concept's folder in 0.3 (§6.2), where 0.2's examples wrote it from the tree's root; one that doesn't resolve is reported, and when it would from the root, the message says to add the `/`. Under 0.2 bare paths are still left alone, and a `sources[].resource` is checked only when written as a path (`/…`, `./…`, `../…`), since it may be a scope descriptor.
  
  `okforest/okf-version-current` links [Upgrade a tree to OKF 0.3](https://www.okforest.ai/docs/guides/upgrade-to-okf-0-3/), a step-by-step guide, rather than the spec's list of changes.

### Patch Changes

- Updated dependencies [d9d9b07]
  - @okforest/okf@0.17.0
  - @okforest/validate@0.17.0

## 0.16.1

### Patch Changes

- 0ee2b67: `okf/extension-key` suggests plain `x-` names (`owner` → `x-owner`) rather than `x-<producer>-<name>` (`x-acme-owner`). OKF 0.3 promises never to define a key starting with `x-`, which is what keeps a tree's own fields from colliding with a later version; the spec's producer name only keeps apart the keys of tools writing to the same files. A bundle's own fields belong to its knowledge, so they're better without a tool's name, or a company's, which would have to change with a rebrand or a merger. The rule still accepts any key starting with `x-`. The `AGENTS.md` that `okforest init` writes says to name fields this way. Its `AGENTS.md` and `README.md` link OKF's `SPEC.md` without a version, since the spec follows `main`, and say the version is `okf_version` in `okf/index.md`.
- Updated dependencies [0ee2b67]
  - @okforest/validate@0.16.1
  - @okforest/okf@0.16.1

## 0.16.0

### Minor Changes

- 538d3e7: - **`okforest/slug` accepts underscores** (lowercase letters, digits, hyphens, and underscores, starting with a letter or digit), so a concept named after something with underscores, such as a table (`n_day_active_users`), can keep its name. Its suggested fix keeps a name's own underscores (`Daily_Users` → `daily_users`).
  - The READMEs, package descriptions, and `--help` link OKF's new home, [open-knowledge-format/open-knowledge-format](https://github.com/open-knowledge-format/open-knowledge-format), and say a tree is checked by the version it declares (0.2 or 0.3). The README's rule table lists every rule, and how a `.md` file counts as a concept under each version. The `README.md` and `AGENTS.md` that `okforest init` writes link the new spec too.
  - A new tree declares OKF 0.3; `npx okforest@0.15.0 init` makes one on 0.2.
- 1158c11: `@okforest/okf` reads trees as OKF 0.3 does (#53), as the [new spec](https://github.com/open-knowledge-format/open-knowledge-format/blob/main/SPEC.md) tells consumers to read every version:
  
  - **Trust tiers count only current verifications** (§5.3): an event counts when its `at` is on or after `generated.at`, the last change to the content, so a page rewritten after a person's review isn't human-reviewed until someone confirms it again. An event without a readable `at` doesn't count (§5.2). The earlier events are kept as `Concept.verifiedBefore`. `deriveTrustTier(verified, generatedAt)` and the new `currentVerifications` do the same.
  - **A status OKF doesn't define isn't `stable`** (§5.4): `Concept.status` is `unrecognized`, and `statusValue` has it as written; absent is still `stable`. `buildInventory`'s `statuses` counts them (`okforest inventory` shows them when there are any).
  - **`superseded_by`** is read (`Concept.supersededBy`), as a path field.
  - **A `stale_after` that isn't a timestamp is never fresh** (§5.5): `isStale()` is true, rather than false.
  - **Timestamps** are RFC 3339 date-times with an offset, or dates, which are the start of that day in UTC (§5): `parseTimestamp`.
  - **Path fields** (§6.2: `resource`, `sources[].resource`, `superseded_by`, `computation`, `executor.resource`, `attester.resource`) resolve as links do, into `Concept.paths`, and those that reach a concept are edges of the bundle graph, so `backlinks` includes them (§6.4). A bundle on 0.2, or no version, may still write them from the bundle root (§12.1): `outlineTree` takes the root `index.md`'s `okf_version` to know.
  - **Files and folders whose names start with `.`** aren't part of a tree (§3.2), as `.okforest/` and `.git/` weren't: `.github/` and the like are left out too.
  - **Absent and single values** (§11.2): null and blank values are absent, one `sources` entry is a list of one, and one tag is never split at commas.
  - **Bundle metadata** (§8.1): `Tree.metadata` has the root `index.md`'s `title`, `description`, and `license` (`readBundleMetadata`).
  - **The OKF version**: `parseOkfVersion`, `okfVersionAtLeast`, and `LATEST_OKF_VERSION` (`"0.3"`).
- af18a42: The rules check each tree by the OKF version its root `index.md` declares (#53): `okf_version: "0.3"` gets OKF 0.3's rules, and `"0.2"`, or no version, keeps 0.2's, so a tree moves when it says so.
  
  - **New `okf/not-a-concept`** (warning, 0.3): a `.md` file without frontmatter or a `type` isn't a concept (§3.2), so consumers skip it; nothing else checks it as one, and a `README.md` no longer needs `ignore:`. Under 0.2, `okf/frontmatter` and `okf/type` still report these as errors.
  - **New `okf/extension-key`** (warning, 0.3): a frontmatter key OKF doesn't define is named `x-<producer>-<name>`, such as `x-acme-owner` (§4.1), so a later version can't define it differently. A type's own fields are extension keys too.
  - **New `okf/log-frontmatter`** (error, 0.3): `log.md` has no frontmatter (§9).
  - **New `okforest/okf-version-current`** (warning): a tree on an older version is told that 0.3 is current, to move when it's ready; one that declares a newer version than this validator knows is told to update okforest or okforest/validate-action.
  - **`okf/datetime`** accepts a date, the start of that day in UTC (§5), for every version, as OKF 0.3 says.
  - **`okf/status`** is a warning, not an error: a status OKF doesn't define isn't `stable`, which OKF 0.3 says to keep and warn about. Under 0.3 it also checks `superseded_by` (a path, with `status: deprecated`).
  - **`okf/actor`** accepts any `<scheme>:<id>`, such as `team:fpa`, and checks a source's `author` too (§7).
  - **`okf/attested-computation`**: under 0.3, each parameter needs a `type` (§10.2).
  - **`okf/okf-version`** asks for `"0.3"`, and no longer says other versions are checked best-effort.
  - `okforest/slug` leaves files that aren't concepts alone, under 0.3.
  - `okforest init` writes `okf_version: "0.3"`.
  - The rule docs link the new spec (open-knowledge-format/open-knowledge-format) and their examples use OKF 0.3.
  
  For tools checking a tree a file at a time: pass the root `index.md`'s version to `outlineTree` (`{ okfVersion }`), which `declaredOkfVersion(text)` reads, so the right version's rules apply. `TreeOutline.okfVersion` carries it to the rules.

### Patch Changes

- Updated dependencies [538d3e7]
- Updated dependencies [1158c11]
- Updated dependencies [db418e4]
- Updated dependencies [af18a42]
  - @okforest/validate@0.16.0
  - @okforest/okf@0.16.0

## 0.15.0

### Minor Changes

- 83318da: `okforest init` creates a repository with an empty tree, and no longer ships templates: `--template` is gone. The repository is laid out as the company template is: the bundle in `okf/` (its `index.md` declaring `okf_version: "0.2"`, `log.md`, and `.okforest/settings.yaml` with the bundle's `name`), a `README.md` with a setup checklist, an `AGENTS.md` for AI agents, a `.gitignore`, `.github/dependabot.yaml`, and `.github/workflows/ci.yaml`, which scans for secrets with Betterleaks (`.betterleaks.toml`) and validates `okf/` on every pull request. The new tree validates with no problems. The default name drops a `-knowledge` suffix from the folder's name, as it does `-okf`. The company template is now a template repository, [okforest/template-company-knowledge](https://github.com/okforest/template-company-knowledge), with 17 types, their schemas and templates, and 39 draft starter concepts: start from it with **Use this template**, or `npx giget gh:okforest/template-company-knowledge acme-knowledge`.
  
  `okforest new` gives a folder it creates an `index.md` listing the new page, and lists the folder in its parent's `index.md`: `okforest new Persona market/personas/cfo.md` writes `market/personas/index.md` and adds it to `market/index.md`.
  
  `okf/index-entries` reports an index that lists nothing only when its directory holds something to list, so a new, empty tree passes.

### Patch Changes

- Updated dependencies [83318da]
  - @okforest/validate@0.15.0
  - @okforest/okf@0.15.0

## 0.14.1

### Patch Changes

- Updated dependencies [2256774]
  - @okforest/validate@0.14.1
  - @okforest/okf@0.14.1

## 0.14.0

### Minor Changes

- f69449c: `okforest init --template company` writes a [type schema](https://www.okforest.ai/docs/types/) for each of its two types, `Organization` and `Customer Profile`, in `.okforest/types/`: the fields each can carry (a website, the year founded, and headquarters; industries, company size, regions, and the buyer's role), shown in the OKForest App and to AI assistants. None is required, and the starter concepts list them, commented out, to fill in.

### Patch Changes

- @okforest/okf@0.14.0
  - @okforest/validate@0.14.0

## 0.13.0

### Minor Changes

- 93d2db6: Type templates (#41): a type can have a starter page beside its schema,
  `.okforest/types/<type>.template.md`, like GitHub's issue templates. It's
  what a new concept of the type starts as: its front matter in its own order,
  its body, and guidance in HTML comments. `okforest new <type> <file>` creates
  a concept from it, with the `--title` and `--description` given put in place
  and every other byte of the template kept, lists it in its folder's
  `index.md`, and shows what's left to fill in. The new
  `okforest/type-template` rule checks that a template names its `type`, and
  that a type has one template. `@okforest/okf` reads templates into
  `Tree.templates` and `TreeOutline.templates` (`readTypeTemplate`;
  `isTypeFilePath` covers the files `outlineTree` needs the text of), and
  `startPage` writes a new concept from a template, for other tools to share.

### Patch Changes

- Updated dependencies [93d2db6]
  - @okforest/okf@0.13.0
  - @okforest/validate@0.13.0

## 0.12.0

### Minor Changes

- 68b8653: Two warnings for types and tags written two ways (#38).
  `okforest/similar-type` reports a concept whose `type` nearly matches another
  the tree uses: another case or punctuation (`metric`, `Product_Summary`), a
  plural (`Metrics`), or a small misspelling (`Metrc`). Such a concept is a
  different type to OKF, so filters and its type's schema miss it. The rule
  suggests the type most likely meant: the one with a schema in
  `.okforest/types/`, then the one more concepts use, then the one written as
  OKF's examples write types. `okforest/similar-tag` does the same for tags,
  preferring lowercase with hyphens. Both use the near-duplicates
  `okforest inventory` lists, which now count two letters swapped as one edit
  (`Metirc` and `Metric`), and no longer pair values whose numbers differ
  (`q1-goals` and `q2-goals`).

### Patch Changes

- Updated dependencies [68b8653]
  - @okforest/okf@0.12.0
  - @okforest/validate@0.12.0

## 0.11.0

### Minor Changes

- 5940dd4: `.okforest/settings.yaml` gains `diagrams`, how OKForest draws a tree's
  diagrams, with a section per diagram language. Its first setting is
  `diagrams.mermaid.renderer`: `mermaid` (the default) or `pele`, which has
  OKForest draw the tree's Mermaid diagrams with Pele (https://pele.run), a
  Mermaid renderer of its own, instead of Mermaid. `@okforest/okf` reads it into
  `TreeSettings.diagrams` (only a value it knows, listed in `MERMAID_RENDERERS`);
  `okforest/settings` reports a `diagrams` section that isn't a mapping and a
  renderer it doesn't know, and `okforest/settings-keys` now checks the keys
  within sections too (`diagrams.mermaid.rendrer`: did you mean `renderer`?).
  The settings JSON Schema has `diagrams` as well.
  
  Findings now point where a key is written when it's reached through a YAML
  alias (`diagrams: *shared` points into its anchor) or read as a number
  (`2026:`), rather than at the file's first line.

### Patch Changes

- Updated dependencies [5940dd4]
  - @okforest/okf@0.11.0
  - @okforest/validate@0.11.0

## 0.10.0

### Minor Changes

- e8f4df7: A new rule, `okf/index-scope` (a warning): an `index.md` lists its own
  directory's contents (OKF §8), so each entry points within the directory
  (into a subdirectory is fine, as a root index often lists pages deeper
  down). An entry pointing elsewhere, as moving a page can leave behind,
  belongs in that page's own directory's index, or in a concept as a link.

### Patch Changes

- Updated dependencies [e8f4df7]
  - @okforest/okf@0.10.0
  - @okforest/validate@0.10.0

## 0.9.0

### Minor Changes

- 8577156: `okforest types init` drafts a JSON Schema for each type in use that has
  none, at `.okforest/types/<type>.schema.json`: each field the type's
  concepts use beyond OKF's, typed by its values, with a format (date,
  date-time, email, URI), allowed values (a few short ones that repeat), or
  `required` (fields every concept has, from two concepts up) where every
  concept agrees. Each field's draft is kept only if every value matches it,
  so the concepts it's drafted from all match the schema. It never overwrites
  a file; `--type` limits it to some types, and `--dry-run` prints the
  drafts. `draftTypeSchema` in `@okforest/validate` does the drafting, and
  `OKF_FIELDS` in `@okforest/okf` lists the frontmatter fields OKF defines,
  which drafts and the `okforest/type-schema` rule leave to the `okf/*`
  rules.

### Patch Changes

- Updated dependencies [8577156]
  - @okforest/okf@0.9.0
  - @okforest/validate@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [0dc0877]
  - @okforest/okf@0.8.0
  - @okforest/validate@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [50d62a9]
  - @okforest/okf@0.7.0
  - @okforest/validate@0.7.0

## 0.6.2

### Patch Changes

- 7b638dc: The README says how to install the CLI (globally, or as a development
  dependency) besides running it with `npx`, and lists `okforest rule`.
- @okforest/okf@0.6.2
  - @okforest/validate@0.6.2

## 0.6.1

### Patch Changes

- b422365: `okforest init` writes its workflow as `.github/workflows/okforest-validate.yaml`,
  with YAML's preferred extension (GitHub reads either).
- @okforest/okf@0.6.1
  - @okforest/validate@0.6.1

## 0.6.0

### Minor Changes

- 4ad2984: `okforest rule <rule>` explains a rule in the terminal: why it exists, an
  example that breaks it, what `okforest validate` reports for it, and the
  fix. With no rule it lists every rule; `--format json` gives the same as
  data, for tools and coding agents. `okforest validate`'s text output now
  points to it.

### Patch Changes

- Updated dependencies [088ceeb]
  - @okforest/validate@0.6.0
  - @okforest/okf@0.6.0

## 0.5.0

### Minor Changes

- 7384f97: OKForest's settings move to `.okforest/settings.yaml`, and every setting is optional: `name` (up to 100 characters), `description` (up to 4,000), and `ignore`. `.okforest/tree.yaml` is no longer read: `tree` becomes `name`, and `title`, `owner`, `backup_owner`, `stewards`, `sensitivity_default`, and `standards` are no longer settings. The rules are renamed `okforest/settings` and `okforest/settings-keys`, and the JSON Schema is now `@okforest/validate/settings.schema.json` (www.okforest.ai/schemas/settings.schema.json).
  
  Every markdown file is now a concept except `index.md`, `log.md`, and files under `.okforest/` and `.git/`, as OKF says: `README.md` and the other repository files, `.github/`, and `node_modules/` are no longer left out by default. List the ones that are not concepts under `ignore`; the CLI doesn't read the text of ignored files. `okforest init` writes `ignore: [README.md]`, and takes `--name` in place of `--owner`, `--tree`, and `--title`.
  
  A breaking change released as a minor version: OKForest is pre-launch.

### Patch Changes

- Updated dependencies [7384f97]
  - @okforest/okf@0.5.0
  - @okforest/validate@0.5.0

## 0.4.0

### Minor Changes

- 1fe2f5c: `.okforest/tree.yaml` gets a JSON Schema and stricter checks. `okforest/tree-yaml` now reports a `.okforest/tree.yml` file, which was silently ignored (only `.yaml` is read). The new `okforest/tree-yaml-keys` rule (warning) reports settings OKForest doesn't know, such as a misspelled key, suggesting the likely one. `@okforest/validate` ships the schema as `@okforest/validate/tree.schema.json` (also at https://www.okforest.ai/schemas/tree.schema.json) and exports `TREE_SETTINGS_KEYS`; `@okforest/okf` exports `editDistance`. `okforest init` starts `tree.yaml` with the schema comment that editors read.

### Patch Changes

- @okforest/okf@0.4.0
  - @okforest/validate@0.4.0

## 0.3.0

### Minor Changes

- 4c05ffc: Findings link to their rule's documentation: `okforest validate` ends its text output with a "Rule docs" list (each rule that reported something, with its page at `https://www.okforest.ai/docs/rules/<rule id>/`), and each finding in the JSON report carries `docs`, that URL. `@okforest/validate` exports `ruleUrl()` and `RULE_DOCS_URL`. The report's schema version stays 1: the field is new, not changed.

### Patch Changes

- @okforest/okf@0.3.0
  - @okforest/validate@0.3.0

## 0.2.2

### Patch Changes

- cca6829: No code changes. Releases now publish only after the tests pass on Linux, macOS, and Windows, and they publish the build CI tested.
- @okforest/okf@0.2.2
  - @okforest/validate@0.2.2

## 0.2.1

### Patch Changes

- d555606: `okforest init`: the company template's GitHub workflow now uses the OKForest Validate action (`okforest/validate-action@v1`) instead of `npx okforest`, so new trees get annotations on pull requests, a job summary, and D2 and Mermaid diagram checks with nothing to install.
- @okforest/okf@0.2.1
  - @okforest/validate@0.2.1

## 0.2.0

### Patch Changes

- 696084a: `@okforest/validate`: add a `diagrams` option to load the D2 and Mermaid engines from somewhere other than the optional peers (each loader returns the module, or `{ unavailable: "<reason>" }` to report those diagrams as not checked), and `toReport()`, the versioned JSON report that `okforest validate --format json` prints. `okforest`: the JSON report now comes from `toReport()` (same output), and the help links to the GitHub README instead of okforest.ai/docs, which is not live yet.
- Updated dependencies [696084a]
  - @okforest/validate@0.2.0
  - @okforest/okf@0.2.0

## 0.1.0

### Minor Changes

- 634105a: Initial release: `@okforest/okf` reads OKF v0.2 trees into a model (concepts, links, backlinks, trust tiers, staleness, and the metadata inventory); `@okforest/validate` checks them with 27 rules (OKF v0.2 conformance, field shapes, links, OKForest conventions, and optional D2 and Mermaid syntax checks); the `okforest` CLI adds `validate`, `inventory`, and `init --template company`.

### Patch Changes

- Updated dependencies [634105a]
  - @okforest/okf@0.1.0
  - @okforest/validate@0.1.0
