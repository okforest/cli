---

"okforest": minor
"@okforest/okf": minor
"@okforest/validate": minor
---

`okforest types init` drafts a JSON Schema for each type in use that has
none, at `.okforest/types/<type>.schema.json`: each field the type's
concepts use beyond OKF's, typed by its values, with a format (date,
date-time, email, URI), allowed values (a few short ones that repeat), or
`required` (fields every concept has, from two concepts up) where every
concept agrees. Each field's draft is kept only if every value matches it,
so the concepts it's drafted from all match the schema. It never overwrites
a file; `--type` limits it to some types, and `--dry-run` prints the
drafts. `draftTypeSchema` in `@okforest/validate` does the drafting, and
`OKF_FIELDS` in `@okforest/okf` lists the frontmatter fields OKF defines,
which drafts and the `okforest/type-schema` rule leave to the `okf/*`
rules.
