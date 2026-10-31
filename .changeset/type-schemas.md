---

"@okforest/okf": minor
"@okforest/validate": minor
---

A type can have a JSON Schema for its concepts' frontmatter, at
`.okforest/types/<type>.schema.json`, and every concept of that type must
match it: the new `okforest/type-schema` rule reports each field that
doesn't (a missing required field, a value outside an `enum`, a date that
isn't one, a field the type doesn't have) as an error, on the field's line.
The schema's `title` names the type, as concepts write it in `type`. OKF's
own fields are left to the `okf/*` rules unless a schema names them, so
`additionalProperties: false` still allows `title` or `verified`. A schema
that can't be used (not JSON, no `title`, a second one for the same type, a
`$ref` that leads nowhere) is reported on its file. Schemas are checked with
`@cfworker/json-schema`, which runs in Workers, drafts 4 to 2020-12.
In `@okforest/okf`, `Tree` and `TreeOutline` have the tree's `types`;
`outlineTree` takes the schemas' texts by path as a third argument, and
`readTree` reads them from disk.
