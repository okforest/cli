---
"@okforest/okf": minor
"okforest": minor
---

`@okforest/okf` reads trees as OKF 0.3 does (#53), as the [new spec](https://github.com/open-knowledge-format/open-knowledge-format/blob/main/SPEC.md) tells consumers to read every version:

- **Trust tiers count only current verifications** (§5.3): an event counts when its `at` is on or after `generated.at`, the last change to the content, so a page rewritten after a person's review isn't human-reviewed until someone confirms it again. An event without a readable `at` doesn't count (§5.2). The earlier events are kept as `Concept.verifiedBefore`. `deriveTrustTier(verified, generatedAt)` and the new `currentVerifications` do the same.
- **A status OKF doesn't define isn't `stable`** (§5.4): `Concept.status` is `unrecognized`, and `statusValue` has it as written; absent is still `stable`. `buildInventory`'s `statuses` counts them (`okforest inventory` shows them when there are any).
- **`superseded_by`** is read (`Concept.supersededBy`), as a path field.
- **A `stale_after` that isn't a timestamp is never fresh** (§5.5): `isStale()` is true, rather than false.
- **Timestamps** are RFC 3339 date-times with an offset, or dates, which are the start of that day in UTC (§5): `parseTimestamp`.
- **Path fields** (§6.2: `resource`, `sources[].resource`, `superseded_by`, `computation`, `executor.resource`, `attester.resource`) resolve as links do, into `Concept.paths`, and those that reach a concept are edges of the bundle graph, so `backlinks` includes them (§6.4). A bundle on 0.2, or no version, may still write them from the bundle root (§12.1): `outlineTree` takes the root `index.md`'s `okf_version` to know.
- **Files and folders whose names start with `.`** aren't part of a tree (§3.2), as `.okforest/` and `.git/` weren't: `.github/` and the like are left out too.
- **Absent and single values** (§11.2): null and blank values are absent, one `sources` entry is a list of one, and one tag is never split at commas.
- **Bundle metadata** (§8.1): `Tree.metadata` has the root `index.md`'s `title`, `description`, and `license` (`readBundleMetadata`).
- **The OKF version**: `parseOkfVersion`, `okfVersionAtLeast`, and `LATEST_OKF_VERSION` (`"0.3"`).
