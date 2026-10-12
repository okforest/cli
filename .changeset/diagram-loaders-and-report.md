---
"@okforest/validate": minor
"okforest": patch
---

`@okforest/validate`: add a `diagrams` option to load the D2 and Mermaid engines from somewhere other than the optional peers (each loader returns the module, or `{ unavailable: "<reason>" }` to report those diagrams as not checked), and `toReport()`, the versioned JSON report that `okforest validate --format json` prints. `okforest`: the JSON report now comes from `toReport()` (same output), and the help links to the GitHub README instead of okforest.ai/docs, which is not live yet.
