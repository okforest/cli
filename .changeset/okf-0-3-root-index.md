---
"@okforest/validate": patch
---

`okf/index-frontmatter` follows the OKF version a tree declares. A bundle-root `index.md` that declares `okf_version: "0.3"` (or later) may also give the bundle's `title`, `description`, and `license`, and extension keys ([OKF 0.3 §8.1](https://github.com/open-knowledge-format/open-knowledge-format/blob/main/SPEC.md#81-bundle-metadata)), so OKF 0.3 bundles no longer fail with "may only declare `okf_version`". One that declares 0.2, or no version, keeps 0.2's rule, and the message now says to declare 0.3 to use them. The first step of OKF 0.3 support (#53).
