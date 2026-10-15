# Contributing

Thanks for helping grow OKForest. The organization-wide guide
([okforest/.github](https://github.com/okforest/.github/blob/main/CONTRIBUTING.md))
covers licensing (Apache 2.0, inbound = outbound), Conventional Commits, and
example-data rules. This file covers this repository.

## Setup

    pnpm install
    pnpm build && pnpm test && pnpm typecheck && pnpm check

All four gates must pass before a PR; CI runs the same commands, on Linux
(with coverage), macOS, and Windows. `main` is protected (the "Protect main"
ruleset): changes land through pull requests once `check` and both `test`
jobs pass. Repository admins can bypass it, for small direct commits and for
merging "Version Packages" PRs, whose checks never run (GitHub runs no
workflows for PRs that a workflow opens). For changes
that could affect speed (parsing, rules that walk every file), compare
`pnpm bench` before and after on the same machine. `pnpm install`
fetches the pinned pnpm and Node versions automatically (`packageManager` and
`devEngines` in `package.json`).

## Layout

| Path | What it is |
|---|---|
| `packages/okf` | `@okforest/okf`: parse a tree into a model. Browser- and Worker-safe; Node file access only in `src/node.ts`. |
| `packages/validate` | `@okforest/validate`: the rules (`src/rules/`) and the runner. |
| `packages/okforest` | The `okforest` CLI and its tree templates (`templates/`). |
| `fixtures/okf-samples` | Google's OKF sample bundles, vendored unmodified. Refresh with `pnpm fixtures:refresh`. |
| `fixtures/rules/<rule id>` | One small failing tree per rule. |
| `fixtures/valid` | A clean tree that exercises every family; must produce no findings. |

## Adding a rule

1. Write it in `packages/validate/src/rules/` with a stable ID (`okf/*` for the
   OKF spec, `okforest/*` for OKForest conventions), a default severity, and a
   one-sentence description. Error only for what the spec requires.
2. Register it in `src/rules/index.ts`.
3. Add a failing tree at `fixtures/rules/<rule id>/` and run
   `pnpm test -- -u` to record its snapshot; review the snapshot.
4. Unit-test any branches the fixture doesn't reach.
5. Add a changeset (`pnpm changeset`).
6. For a new `.okforest/tree.yaml` setting: add it to `TREE_SETTINGS_KEYS`
   and `packages/validate/schemas/tree.schema.json` (a test fails until both
   agree), and document it on okforest/platform's Tree settings page.
7. After the release, bump `@okforest/validate` in okforest/platform and
   deploy the site: the rule's page (`www.okforest.ai/docs/rules/<rule id>/`,
   which findings link to) is generated from the package, so the link is a
   404 until then. Then release okforest/validate-action with the new rules.

## Releasing

Releases go through Changesets: merging changeset files to `main` opens a
"Version Packages" PR, and merging that PR (an admin bypass, as above)
publishes all three packages to npm with provenance, through npm trusted
publishing (GitHub Actions OIDC; no npm token is stored anywhere). CI runs on
the merged commit, and only when every check passes does its `release` job
publish, using the build the `check` job tested, not a new one. PRs without a
changeset (Dependabot's, docs) never open or change the Version Packages PR.

**Immutable releases.** The repository has release immutability on (Settings →
Releases), from 0.3.1: once published, a GitHub Release's tag
(`okforest@1.2.3`, `@okforest/okf@1.2.3`, `@okforest/validate@1.2.3`) can't be
moved or deleted, matching npm, where a published version never changes. Fix a
bad release with a new version. Titles and notes can still be edited. The
release job warns if a new release didn't come out immutable, or if it
couldn't mark `okforest@<version>` as Latest.

**First release only (done for 0.1.0).** npm trusted publishing can only be configured for a
package that already exists, so the first version of each package is
published by hand:

1. Let CI's release job open the "Version Packages" PR (it versions the
   packages to 0.1.0 from `.changeset/initial-release.md`), and check out its
   branch locally.
2. `pnpm install && pnpm build`, then `npm login` as an owner of the
   `@okforest` npm organization, and `pnpm -r publish --access public`.
3. On npmjs.com, for each of `okforest`, `@okforest/okf`, and
   `@okforest/validate`: Settings → Trusted publishing → GitHub Actions, with
   organization `okforest`, repository `cli`, and workflow `ci.yml` (it was
   `release.yml` until 0.2.2).
   Then disallow token publishing.
4. Merge the "Version Packages" PR. The workflow finds the versions already
   published, skips them, and tags the release.
