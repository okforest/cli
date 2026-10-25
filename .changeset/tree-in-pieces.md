---
"@okforest/okf": minor
"@okforest/validate": minor
---

Trees too large to hold parsed at once can be read and validated a file at a
time, with the same findings. `outlineTree(paths, settingsText)` in
`@okforest/okf` works out a tree from its paths alone, and its `read(path,
text)` parses one markdown file with its links resolved against the whole
tree; `parseTree` is built on it. In `@okforest/validate`, a rule now checks
each file (`checkFile`) and the tree's outline (`checkTree`), and
`treeChecker(outline)` validates the files as they're read. Breaking: a
custom rule's `check(context)`, which saw the whole parsed tree
(`context.tree`), is gone; write it as `checkFile` and `checkTree`, as every
built-in rule now is. `RuleContext` is now `CheckContext`, with the tree's
`outline` in place of `tree`.
On a tree of about 10,000 concepts, a file-at-a-time run keeps about 11 MB
beyond the files' text as it goes, against about 430 MB for the tree parsed
whole.
