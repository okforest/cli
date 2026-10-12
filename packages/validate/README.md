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
date checks). A rule is `{ id, severity, description, check(context) }`, so
your own rules plug in alongside the built-in ones.

Diagram checks load the optional peers `@d2lang/d2` and `mermaid` if they are
installed; otherwise diagram blocks are reported as not checked (`info`).

The full rule list is in the [OKForest CLI README](https://github.com/okforest/cli#rules).

Part of the [OKForest CLI](https://github.com/okforest/cli) · Apache-2.0 · © Preneur LLC
