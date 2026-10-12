# AGENTS.md

The open-source OKForest toolkit: `packages/okf` (`@okforest/okf`, the OKF
parser and model), `packages/validate` (`@okforest/validate`, the rules), and
`packages/okforest` (the `okforest` CLI). The hosted service lives in a
separate private repository; nothing here may depend on it or reference its
internals (dependencies point one way: private → public).

- Gates before any push: `pnpm build && pnpm test && pnpm typecheck && pnpm check`.
- `@okforest/okf` and `@okforest/validate` run in Node, browsers, and Workers:
  only `packages/okf/src/node.ts` may import `node:*`, and `@okforest/okf`'s
  only runtime dependencies are its YAML and markdown parsers (no SDKs or
  frameworks). `packages/okf/test/boundaries.test.ts` enforces this.
- Diagram checks use the optional peers `@d2lang/d2` and `mermaid`, loaded
  with dynamic `import()` only; never add them as dependencies.
- Validation is deterministic: no model calls, no network, and output sorted
  so it is identical on every machine.
- Rules have stable, namespaced IDs (`okf/*` for the OKF v0.2 spec,
  `okforest/*` for OKForest conventions). Severity follows the spec: what it
  requires is an `error`; what it recommends, and OKForest conventions, are
  `warning` or `info`. Never make broken links an error (OKF §6.1, §11).
- Every rule has a failing fixture at `fixtures/rules/<rule id>/`
  (`fixtures.test.ts` fails otherwise), and `fixtures/valid/` must stay free
  of findings.
- `fixtures/okf-samples/` is Google's OKF sample bundles, vendored unmodified
  (Apache 2.0, see its NOTICE). Never edit them; refresh with
  `pnpm fixtures:refresh` and review the snapshot diff.
- The `--format json` output of `validate` and `inventory` is a public
  interface (the GitHub Action consumes it): bump `schemaVersion` on breaking
  changes.
- Examples use reserved domains (`acme.example`) and placeholder names.
- Releases go through Changesets (`pnpm changeset`), lockstep 0.x across all
  three packages.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
