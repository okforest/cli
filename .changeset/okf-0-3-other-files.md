---
"@okforest/okf": minor
"@okforest/validate": minor
"okforest": minor
---

**Under OKF 0.3, a `.md` file without frontmatter or a `type` isn't read as a concept** (§3.2), so it's skipped as OKF says: a `README.md` is no longer counted, listed, or linked to as one. Trees on 0.2, or no version, read as before.

- `@okforest/okf`: such a file is an `OtherMarkdown` (`kind: "other"`), in the new `Tree.otherMarkdown`, not `Tree.concepts`; `tree.concept(id)` and `backlinks` leave it out, and a link to it names no `concept`. `buildInventory` counts only concepts.
- **Renamed, for the three kinds of markdown file**: `ReservedFile` (`index.md` and `log.md`) is now `ReservedMarkdown`, beside `Concept` and `OtherMarkdown`. Files that don't end in `.md` are assets (§3.2), which stay paths in `Tree.files`.
- **For tools reading a tree a file at a time**: `TreeOutline.read` can now return an `OtherMarkdown` (its return type is `Concept | ReservedMarkdown | OtherMarkdown`), when `outlineTree` is given a root `index.md` declaring 0.3 (`{ okfVersion: declaredOkfVersion(text) }`). Skip it as a concept. A link read this way still names the concept its target's path would be, since whether that file is one isn't known until it's read.
- `@okforest/validate`: `okf/not-a-concept` reports `OtherMarkdown`s, and the other rules check only concepts, so findings are unchanged; a validation's `concepts` count leaves them out. `checkFile` and `TreeChecker.check` take an `OtherMarkdown` too.

**`okf/broken-link` checks bare path fields under OKF 0.3.** A `resource`, `computation`, `executor.resource`, `attester.resource`, or `superseded_by` without a leading `/` resolves from the concept's folder in 0.3 (§6.2), where 0.2's examples wrote it from the tree's root; one that doesn't resolve is reported, and when it would from the root, the message says to add the `/`. Under 0.2 bare paths are still left alone, and a `sources[].resource` is checked only when written as a path (`/…`, `./…`, `../…`), since it may be a scope descriptor.

`okforest/okf-version-current` links [Upgrade a tree to OKF 0.3](https://www.okforest.ai/docs/guides/upgrade-to-okf-0-3/), a step-by-step guide, rather than the spec's list of changes.
