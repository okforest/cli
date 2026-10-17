# {{name}}

An [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/open-knowledge-format)
v0.2 tree: one markdown file per concept, with YAML frontmatter.

- Start at [`index.md`](index.md). `index.md` and `log.md` files are reserved;
  every other `.md` file is a concept.
- The starter concepts are drafts (`status: draft`): fill them in, then remove
  the guidance comments.
- This README is not a concept: [`.okforest/settings.yaml`](.okforest/settings.yaml)
  lists it under `ignore`.
- Validate with `npx okforest validate .`; the workflow in
  `.github/workflows/okforest-validate.yml` runs it on every pull request.

Created with the [OKForest CLI](https://github.com/okforest/cli) `company` template.
