# okforest

## 0.2.2

### Patch Changes

- cca6829: No code changes. Releases now publish only after the tests pass on Linux, macOS, and Windows, and they publish the build CI tested.
- @okforest/okf@0.2.2
  - @okforest/validate@0.2.2

## 0.2.1

### Patch Changes

- d555606: `okforest init`: the company template's GitHub workflow now uses the OKForest Validate action (`okforest/validate-action@v1`) instead of `npx okforest`, so new trees get annotations on pull requests, a job summary, and D2 and Mermaid diagram checks with nothing to install.
- @okforest/okf@0.2.1
  - @okforest/validate@0.2.1

## 0.2.0

### Patch Changes

- 696084a: `@okforest/validate`: add a `diagrams` option to load the D2 and Mermaid engines from somewhere other than the optional peers (each loader returns the module, or `{ unavailable: "<reason>" }` to report those diagrams as not checked), and `toReport()`, the versioned JSON report that `okforest validate --format json` prints. `okforest`: the JSON report now comes from `toReport()` (same output), and the help links to the GitHub README instead of okforest.ai/docs, which is not live yet.
- Updated dependencies [696084a]
  - @okforest/validate@0.2.0
  - @okforest/okf@0.2.0

## 0.1.0

### Minor Changes

- 634105a: Initial release: `@okforest/okf` reads OKF v0.2 trees into a model (concepts, links, backlinks, trust tiers, staleness, and the metadata inventory); `@okforest/validate` checks them with 27 rules (OKF v0.2 conformance, field shapes, links, OKForest conventions, and optional D2 and Mermaid syntax checks); the `okforest` CLI adds `validate`, `inventory`, and `init --template company`.

### Patch Changes

- Updated dependencies [634105a]
  - @okforest/okf@0.1.0
  - @okforest/validate@0.1.0
