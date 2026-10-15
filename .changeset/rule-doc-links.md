---
"okforest": minor
---

Findings link to their rule's documentation: `okforest validate` ends its text output with a "Rule docs" list (each rule that reported something, with its page at `https://www.okforest.ai/docs/rules/<rule id>/`), and each finding in the JSON report carries `docs`, that URL. `@okforest/validate` exports `ruleUrl()` and `RULE_DOCS_URL`. The report's schema version stays 1: the field is new, not changed.
