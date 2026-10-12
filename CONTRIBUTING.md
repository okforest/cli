# Contributing

Thanks for helping grow OKForest. The organization-wide guide
([okforest/.github](https://github.com/okforest/.github/blob/main/CONTRIBUTING.md))
covers licensing (Apache 2.0, inbound = outbound), Conventional Commits, and
example-data rules. This file covers this repository.

## Setup

    pnpm install
    pnpm build && pnpm test && pnpm typecheck && pnpm check

All four gates must pass before a PR; CI runs the same commands. `pnpm install`
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

## Releasing

Releases go through Changesets: merging changeset files to `main` opens a
"Version Packages" PR, and merging that PR publishes all three packages to npm
with provenance, through npm trusted publishing (GitHub Actions OIDC; no npm
token is stored anywhere).

**First release only.** npm trusted publishing can only be configured for a
package that already exists, so the first version of each package is
published by hand:

1. Let the release workflow open the "Version Packages" PR (it versions the
   packages to 0.1.0 from `.changeset/initial-release.md`), and check out its
   branch locally.
2. `pnpm install && pnpm build`, then `npm login` as an owner of the
   `@okforest` npm organization, and `pnpm -r publish --access public`.
3. On npmjs.com, for each of `okforest`, `@okforest/okf`, and
   `@okforest/validate`: Settings → Trusted publishing → GitHub Actions, with
   organization `okforest`, repository `cli`, and workflow `release.yml`.
   Then disallow token publishing.
4. Merge the "Version Packages" PR. The workflow finds the versions already
   published, skips them, and tags the release.
