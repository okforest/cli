---
"@okforest/validate": minor
"@okforest/okf": minor
"okforest": minor
---

The rules check each tree by the OKF version its root `index.md` declares (#53): `okf_version: "0.3"` gets OKF 0.3's rules, and `"0.2"`, or no version, keeps 0.2's, so a tree moves when it says so.

- **New `okf/not-a-concept`** (warning, 0.3): a `.md` file without frontmatter or a `type` isn't a concept (§3.2), so consumers skip it; nothing else checks it as one, and a `README.md` no longer needs `ignore:`. Under 0.2, `okf/frontmatter` and `okf/type` still report these as errors.
- **New `okf/extension-key`** (warning, 0.3): a frontmatter key OKF doesn't define is named `x-<producer>-<name>`, such as `x-acme-owner` (§4.1), so a later version can't define it differently. A type's own fields are extension keys too.
- **New `okf/log-frontmatter`** (error, 0.3): `log.md` has no frontmatter (§9).
- **New `okforest/okf-version-current`** (warning): a tree on an older version is told that 0.3 is current, to move when it's ready; one that declares a newer version than this validator knows is told to update okforest or okforest/validate-action.
- **`okf/datetime`** accepts a date, the start of that day in UTC (§5), for every version, as OKF 0.3 says.
- **`okf/status`** is a warning, not an error: a status OKF doesn't define isn't `stable`, which OKF 0.3 says to keep and warn about. Under 0.3 it also checks `superseded_by` (a path, with `status: deprecated`).
- **`okf/actor`** accepts any `<scheme>:<id>`, such as `team:fpa`, and checks a source's `author` too (§7).
- **`okf/attested-computation`**: under 0.3, each parameter needs a `type` (§10.2).
- **`okf/okf-version`** asks for `"0.3"`, and no longer says other versions are checked best-effort.
- `okforest/slug` leaves files that aren't concepts alone, under 0.3.
- `okforest init` writes `okf_version: "0.3"`.
- The rule docs link the new spec (open-knowledge-format/open-knowledge-format) and their examples use OKF 0.3.

For tools checking a tree a file at a time: pass the root `index.md`'s version to `outlineTree` (`{ okfVersion }`), which `declaredOkfVersion(text)` reads, so the right version's rules apply. `TreeOutline.okfVersion` carries it to the rules.
