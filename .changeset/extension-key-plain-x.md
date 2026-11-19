---
"@okforest/validate": patch
"okforest": patch
---

`okf/extension-key` suggests plain `x-` names (`owner` → `x-owner`) rather than `x-<producer>-<name>` (`x-acme-owner`). OKF 0.3 promises never to define a key starting with `x-`, which is what keeps a tree's own fields from colliding with a later version; the spec's producer name only keeps apart the keys of tools writing to the same files. A bundle's own fields belong to its knowledge, so they're better without a tool's name, or a company's, which would have to change with a rebrand or a merger. The rule still accepts any key starting with `x-`. The `AGENTS.md` that `okforest init` writes says to name fields this way. Its `AGENTS.md` and `README.md` link OKF's `SPEC.md` without a version, since the spec follows `main`, and say the version is `okf_version` in `okf/index.md`.
