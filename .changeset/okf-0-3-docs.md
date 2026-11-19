---
"@okforest/validate": minor
"okforest": minor
"@okforest/okf": minor
---

- **`okforest/slug` accepts underscores** (lowercase letters, digits, hyphens, and underscores, starting with a letter or digit), so a concept named after something with underscores, such as a table (`n_day_active_users`), can keep its name. Its suggested fix keeps a name's own underscores (`Daily_Users` → `daily_users`).
- The READMEs, package descriptions, and `--help` link OKF's new home, [open-knowledge-format/open-knowledge-format](https://github.com/open-knowledge-format/open-knowledge-format), and say a tree is checked by the version it declares (0.2 or 0.3). The README's rule table lists every rule, and how a `.md` file counts as a concept under each version. The `README.md` and `AGENTS.md` that `okforest init` writes link the new spec too.
- A new tree declares OKF 0.3; `npx okforest@0.15.0 init` makes one on 0.2.
