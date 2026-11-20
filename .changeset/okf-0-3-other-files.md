---
"@okforest/okf": minor
"@okforest/validate": minor
"okforest": minor
---

**Under OKF 0.3, a `.md` file without frontmatter or a `type` isn't read as a concept** (§3.2), so it's skipped as OKF says: a `README.md` is no longer counted, listed, or linked to as one. Trees on 0.2, or no version, read as before.

- `@okforest/okf`: such a file is an `OtherFile` (`kind: "other"`), in the new `Tree.others`, not `Tree.concepts`; `tree.concept(id)` and `backlinks` leave it out, and a link to it names no `concept`. `buildInventory` counts only concepts.
- **For tools reading a tree a file at a time**: `TreeOutline.read` can now return an `OtherFile` (its return type is `Concept | ReservedFile | OtherFile`), when `outlineTree` is given a root `index.md` declaring 0.3 (`{ okfVersion: declaredOkfVersion(text) }`). Skip it as a concept. A link read this way still names the concept its target's path would be, since whether that file is one isn't known until it's read.
- `@okforest/validate`: `okf/not-a-concept` reports `OtherFile`s, and the other rules check only concepts, so findings are unchanged; a validation's `concepts` count leaves them out. `checkFile` and `TreeChecker.check` take an `OtherFile` too.
