# @okforest/okf

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

## 0.6.2

No changes in this release.

## 0.6.1

No changes in this release.

## 0.6.0

No changes in this release.

## 0.5.0

### Minor Changes

- 7384f97: OKForest's settings move to `.okforest/settings.yaml`, and every setting is optional: `name` (up to 100 characters), `description` (up to 4,000), and `ignore`. `.okforest/tree.yaml` is no longer read: `tree` becomes `name`, and `title`, `owner`, `backup_owner`, `stewards`, `sensitivity_default`, and `standards` are no longer settings. The rules are renamed `okforest/settings` and `okforest/settings-keys`, and the JSON Schema is now `@okforest/validate/settings.schema.json` (www.okforest.ai/schemas/settings.schema.json).
  
  Every markdown file is now a concept except `index.md`, `log.md`, and files under `.okforest/` and `.git/`, as OKF says: `README.md` and the other repository files, `.github/`, and `node_modules/` are no longer left out by default. List the ones that are not concepts under `ignore`; the CLI doesn't read the text of ignored files. `okforest init` writes `ignore: [README.md]`, and takes `--name` in place of `--owner`, `--tree`, and `--title`.
  
  A breaking change released as a minor version: OKForest is pre-launch.

## 0.4.0

No changes in this release.

## 0.3.0

No changes in this release.

## 0.2.2

No changes in this release.

## 0.2.1

No changes in this release.

## 0.2.0

No changes in this release.

## 0.1.0

### Minor Changes

- 634105a: Initial release: `@okforest/okf` reads OKF v0.2 trees into a model (concepts, links, backlinks, trust tiers, staleness, and the metadata inventory); `@okforest/validate` checks them with 27 rules (OKF v0.2 conformance, field shapes, links, OKForest conventions, and optional D2 and Mermaid syntax checks); the `okforest` CLI adds `validate`, `inventory`, and `init --template company`.
