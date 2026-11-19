---
"okforest": minor
"@okforest/validate": minor
---

`okforest init` creates a repository with an empty tree, and no longer ships templates: `--template` is gone. The repository is laid out as the company template is: the bundle in `okf/` (its `index.md` declaring `okf_version: "0.2"`, `log.md`, and `.okforest/settings.yaml` with the bundle's `name`), a `README.md` with a setup checklist, an `AGENTS.md` for AI agents, a `.gitignore`, `.github/dependabot.yaml`, and `.github/workflows/ci.yaml`, which scans for secrets with Betterleaks (`.betterleaks.toml`) and validates `okf/` on every pull request. The new tree validates with no problems. The default name drops a `-knowledge` suffix from the folder's name, as it does `-okf`. The company template is now a template repository, [okforest/template-company-knowledge](https://github.com/okforest/template-company-knowledge), with 17 types, their schemas and templates, and 39 draft starter concepts: start from it with **Use this template**, or `npx giget gh:okforest/template-company-knowledge acme-knowledge`.

`okforest new` gives a folder it creates an `index.md` listing the new page, and lists the folder in its parent's `index.md`: `okforest new Persona market/personas/cfo.md` writes `market/personas/index.md` and adds it to `market/index.md`.

`okf/index-entries` reports an index that lists nothing only when its directory holds something to list, so a new, empty tree passes.
