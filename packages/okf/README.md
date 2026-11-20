# @okforest/okf

Read an [Open Knowledge Format (OKF)](https://github.com/open-knowledge-format/open-knowledge-format)
tree, 0.2 or 0.3, into a model: concepts (path, concept ID, frontmatter, body as
[mdast](https://github.com/syntax-tree/mdast)), reserved `index.md` and
`log.md` files, links in both absolute and relative forms, backlinks, and the
OKF fields with their derived values: trust tier, lifecycle status, and
staleness, read as OKF 0.3 says to read every version. Also builds the metadata inventory: every type, tag, and
frontmatter key in use, with near-duplicates.

No SDKs or frameworks: the core is pure and runs in Node, browsers, and
Workers. Reading from disk is a separate entry point.

```ts
import { buildInventory } from "@okforest/okf"
import { readTree } from "@okforest/okf/node"

const tree = await readTree("./sales-okf")
const orders = tree.concept("tables/orders")
orders?.trustTier // "unverified" | "machine-confirmed" | "human-reviewed"
orders?.isStale() // now >= stale_after
tree.backlinks("tables/orders") // links from other concepts
buildInventory(tree).nearDuplicates // e.g. e-commerce ~ ecommerce
```

Without a file system, pass the files yourself:

```ts
import { parseTree } from "@okforest/okf"

const tree = parseTree([
  { path: "index.md", text: '---\nokf_version: "0.2"\n---\n# Tables\n' },
  { path: "tables/orders.md", text: "---\ntype: BigQuery Table\n---\n# Schema\n" },
])
```

A tree too large to hold parsed at once can be read one file at a time.
`outlineTree` works out the tree from its paths alone (and the texts of the
settings file, the type schemas, and the root `index.md`'s `okf_version`);
`read` then parses one of its markdown files, with its links resolved against
the whole tree, as `parseTree` would:

```ts
import { declaredOkfVersion, outlineTree } from "@okforest/okf"

// .okforest/settings.yaml, if any, and .okforest/types/*.schema.json by path
const outline = outlineTree(paths, settingsText, typeTexts, {
  okfVersion: declaredOkfVersion(rootIndexText),
})
for (const path of outline.markdown) {
  // A Concept, a ReservedFile (index.md, log.md), or, under OKF 0.3, an
  // OtherFile: one without a `type`, which isn't a concept (§3.2).
  const file = outline.read(path, await textOf(path))
  // ...use it, and let it go
}
```

Read this way, a link's `concept` is the ID its target's path gives: under
OKF 0.3 that file may turn out to be an `OtherFile` once it's read, which
`parseTree` accounts for and a reader going a file at a time has to.

Parsing never throws on malformed content: problems are recorded on each file
(`frontmatterError`) for [`@okforest/validate`](https://www.npmjs.com/package/@okforest/validate)
to report.

Part of the [OKForest CLI](https://github.com/okforest/cli) · Apache-2.0 · © Preneur LLC
