# okforest

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
