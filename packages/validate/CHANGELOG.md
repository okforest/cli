# @okforest/validate

## 0.7.0

### Minor Changes

- 50d62a9: Trees too large to hold parsed at once can be read and validated a file at a
  time, with the same findings. `outlineTree(paths, settingsText)` in
  `@okforest/okf` works out a tree from its paths alone, and its `read(path,
  text)` parses one markdown file with its links resolved against the whole
  tree; `parseTree` is built on it. In `@okforest/validate`, a rule now checks
  each file (`checkFile`) and the tree's outline (`checkTree`), and
  `treeChecker(outline)` validates the files as they're read. Breaking: a
  custom rule's `check(context)`, which saw the whole parsed tree
  (`context.tree`), is gone; write it as `checkFile` and `checkTree`, as every
  built-in rule now is. `RuleContext` is now `CheckContext`, with the tree's
  `outline` in place of `tree`.
  On a tree of about 10,000 concepts, a file-at-a-time run keeps about 11 MB
  beyond the files' text as it goes, against about 430 MB for the tree parsed
  whole.

### Patch Changes

- Updated dependencies [50d62a9]
  - @okforest/okf@0.7.0

## 0.6.2

### Patch Changes

- @okforest/okf@0.6.2

## 0.6.1

### Patch Changes

- @okforest/okf@0.6.1

## 0.6.0

### Minor Changes

- 088ceeb: `ruleDocs`: for every rule, why it exists (linking the OKF specification or
  OKForest's docs) and an example that breaks it, with the findings it
  produces and the fix, tested so they stay true. The rule pages at
  https://www.okforest.ai/docs/rules/ show them.

### Patch Changes

- @okforest/okf@0.6.0

## 0.5.0

### Minor Changes

- 7384f97: OKForest's settings move to `.okforest/settings.yaml`, and every setting is optional: `name` (up to 100 characters), `description` (up to 4,000), and `ignore`. `.okforest/tree.yaml` is no longer read: `tree` becomes `name`, and `title`, `owner`, `backup_owner`, `stewards`, `sensitivity_default`, and `standards` are no longer settings. The rules are renamed `okforest/settings` and `okforest/settings-keys`, and the JSON Schema is now `@okforest/validate/settings.schema.json` (www.okforest.ai/schemas/settings.schema.json).
  
  Every markdown file is now a concept except `index.md`, `log.md`, and files under `.okforest/` and `.git/`, as OKF says: `README.md` and the other repository files, `.github/`, and `node_modules/` are no longer left out by default. List the ones that are not concepts under `ignore`; the CLI doesn't read the text of ignored files. `okforest init` writes `ignore: [README.md]`, and takes `--name` in place of `--owner`, `--tree`, and `--title`.
  
  A breaking change released as a minor version: OKForest is pre-launch.

### Patch Changes

- Updated dependencies [7384f97]
  - @okforest/okf@0.5.0

## 0.4.0

### Patch Changes

- @okforest/okf@0.4.0

## 0.3.0

### Patch Changes

- @okforest/okf@0.3.0

## 0.2.2

### Patch Changes

- @okforest/okf@0.2.2

## 0.2.1

### Patch Changes

- @okforest/okf@0.2.1

## 0.2.0

### Minor Changes

- 696084a: `@okforest/validate`: add a `diagrams` option to load the D2 and Mermaid engines from somewhere other than the optional peers (each loader returns the module, or `{ unavailable: "<reason>" }` to report those diagrams as not checked), and `toReport()`, the versioned JSON report that `okforest validate --format json` prints. `okforest`: the JSON report now comes from `toReport()` (same output), and the help links to the GitHub README instead of okforest.ai/docs, which is not live yet.

### Patch Changes

- @okforest/okf@0.2.0

## 0.1.0

### Minor Changes

- 634105a: Initial release: `@okforest/okf` reads OKF v0.2 trees into a model (concepts, links, backlinks, trust tiers, staleness, and the metadata inventory); `@okforest/validate` checks them with 27 rules (OKF v0.2 conformance, field shapes, links, OKForest conventions, and optional D2 and Mermaid syntax checks); the `okforest` CLI adds `validate`, `inventory`, and `init --template company`.

### Patch Changes

- Updated dependencies [634105a]
  - @okforest/okf@0.1.0
