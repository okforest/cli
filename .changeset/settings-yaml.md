---
"@okforest/okf": minor
"@okforest/validate": minor
"okforest": minor
---

OKForest's settings move to `.okforest/settings.yaml`, and every setting is optional: `name` (up to 100 characters), `description` (up to 4,000), and `ignore`. A `.okforest/tree.yaml` is reported as an error that says how to move it; `tree` becomes `name`, and `title`, `owner`, `backup_owner`, `stewards`, `sensitivity_default`, and `standards` are no longer settings (the `okforest/settings-keys` warning says so for each). The rules are renamed `okforest/settings` and `okforest/settings-keys`, and the JSON Schema is now `@okforest/validate/settings.schema.json` (www.okforest.ai/schemas/settings.schema.json).

Every markdown file is now a concept except `index.md`, `log.md`, and files under `.okforest/` and `.git/`, as OKF says: `README.md` and the other repository files, `.github/`, and `node_modules/` are no longer left out by default. List the ones that are not concepts under `ignore`; the CLI doesn't read the text of ignored files. `okforest init` writes `ignore: [README.md]`, and takes `--name` in place of `--owner`, `--tree`, and `--title`.

A breaking change released as a minor version: OKForest is pre-launch.
