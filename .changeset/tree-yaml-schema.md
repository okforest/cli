---
"okforest": minor
---

`.okforest/tree.yaml` gets a JSON Schema and stricter checks. `okforest/tree-yaml` now reports a `.okforest/tree.yml` file, which was silently ignored (only `.yaml` is read). The new `okforest/tree-yaml-keys` rule (warning) reports settings OKForest doesn't know, such as a misspelled key, suggesting the likely one. `@okforest/validate` ships the schema as `@okforest/validate/tree.schema.json` (also at https://www.okforest.ai/schemas/tree.schema.json) and exports `TREE_SETTINGS_KEYS`; `@okforest/okf` exports `editDistance`. `okforest init` starts `tree.yaml` with the schema comment that editors read.
