# @okforest/validate

Validate [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/open-knowledge-format)
v0.2 trees: spec conformance, field shapes, links, OKForest conventions, and
D2 and Mermaid diagram syntax. Findings are structured, with stable rule IDs,
severities, and file, line, and column locations. Deterministic: no model
calls and no network.

```ts
import { readTree } from "@okforest/okf/node"
import { validate } from "@okforest/validate"

const result = await validate(await readTree("./sales-okf"))
result.ok // no errors (warnings and info never fail)
for (const f of result.findings) {
  console.log(`${f.file}:${f.line ?? ""} ${f.severity} ${f.ruleId} ${f.message}`)
}
```

Options: `rules` (defaults to `defaultRules`, which is `okfRules` plus
`okforestRules`), `severity` (per-rule overrides, or `"off"`), and `now` (for
date checks). A rule is `{ id, severity, description }` with
`checkFile(file, context)`, run for each concept, `index.md`, and `log.md`,
and `checkTree(context)`, run once on the tree's outline (its paths and
settings), so your own rules plug in alongside the built-in ones.

A tree too large to hold parsed at once is validated a file at a time, as
[`@okforest/okf`](https://www.npmjs.com/package/@okforest/okf)'s
`outlineTree` reads it, with the same findings as `validate`:

```ts
import { outlineTree } from "@okforest/okf"
import { treeChecker } from "@okforest/validate"

const outline = outlineTree(paths, settingsText)
const checker = treeChecker(outline)
for (const path of outline.markdown) await checker.check(outline.read(path, await textOf(path)))
const result = await checker.finish() // always call it: it disposes of diagram engines
```

Diagram checks load the optional peers `@d2lang/d2` and `mermaid` if they are
installed; otherwise diagram blocks are reported as not checked (`info`). To
load them from somewhere else (a bundle, a download), pass `diagrams` loaders.
Each runs at most once per validation, and only if the tree has diagrams of
that language; return the module, or `{ unavailable: "<reason>" }`:

```ts
await validate(tree, {
  diagrams: {
    d2: async () => (await fetchD2()) ?? { unavailable: "D2 could not be downloaded." },
  },
})
```

`toReport(result, { tool, path })` wraps a result as the versioned JSON
document that `okforest validate --format json` prints (`schemaVersion: 1`),
so other tools can produce and consume the same format. Each finding in it
carries `docs`, the URL of its rule's page; `ruleUrl(ruleId)` gives the same
URL (`https://www.okforest.ai/docs/rules/<rule id>/`).

The full rule list is in the [OKForest CLI README](https://github.com/okforest/cli#rules).

Part of the [OKForest CLI](https://github.com/okforest/cli) · Apache-2.0 · © Preneur LLC
