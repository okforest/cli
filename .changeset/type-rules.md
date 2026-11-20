---
"@okforest/okf": minor
"@okforest/validate": minor
"okforest": minor
---

**Three rules for a tree's types, so they don't drift from its pages** (#64):

- **`okforest/type-file-name`** (warning): a type's schema and template in `.okforest/types/` are named for it, `customer-profile.schema.json` and `customer-profile.template.md` for `Customer Profile`, as `okforest types init` names them. A file named for another type still works, since the type is read from inside it, but it misleads anyone reading the folder.
- **`okforest/unused-type`** (info): a type no concept in the tree gives any more, once, naming its schema and template. Often left by a renamed type or a split tree; a type defined before its pages is fine, so it's only noted.
- **`okforest/undeclared-type`** (info): in a tree with type schemas, a type its concepts give that has none, once, at its first page, with how many give it; `okforest types init` drafts the schema. A tree with no schemas, OKF's own `Attested Computation`, and a near-duplicate of another type (which `okforest/similar-type` points out) are left alone.

`@okforest/okf` exports `typeSlug`, the name a type's files take, which `okforest types init` and the new rule share.
