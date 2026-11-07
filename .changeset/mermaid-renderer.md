---

"okforest": minor
"@okforest/okf": minor
"@okforest/validate": minor
---

`.okforest/settings.yaml` gains `diagrams`, how OKForest draws a tree's
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
