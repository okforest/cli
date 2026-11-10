---

"okforest": minor
"@okforest/okf": minor
"@okforest/validate": minor
---

Type templates (#41): a type can have a starter page beside its schema,
`.okforest/types/<type>.template.md`, like GitHub's issue templates. It's
what a new concept of the type starts as: its front matter in its own order,
its body, and guidance in HTML comments. `okforest new <type> <file>` creates
a concept from it, with the `--title` and `--description` given put in place
and every other byte of the template kept, lists it in its folder's
`index.md`, and shows what's left to fill in. The new
`okforest/type-template` rule checks that a template names its `type`, and
that a type has one template. `@okforest/okf` reads templates into
`Tree.templates` and `TreeOutline.templates` (`readTypeTemplate`;
`isTypeFilePath` covers the files `outlineTree` needs the text of), and
`startPage` writes a new concept from a template, for other tools to share.
