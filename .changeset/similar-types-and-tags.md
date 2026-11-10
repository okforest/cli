---

"okforest": minor
"@okforest/okf": minor
"@okforest/validate": minor
---

Two warnings for types and tags written two ways (#38).
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
