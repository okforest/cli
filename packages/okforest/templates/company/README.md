# {{title}}

An [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/open-knowledge-format)
v0.2 tree: one markdown file per concept, with YAML frontmatter.

- Start at [`index.md`](index.md). `index.md` and `log.md` files are reserved;
  every other `.md` file is a concept.
- The starter concepts are drafts (`status: draft`): fill them in, then remove
  the guidance comments.
- Owner and Stewards are in [`.okforest/tree.yaml`](.okforest/tree.yaml).
- Validate with `npx okforest validate .`; the workflow in
  `.github/workflows/okforest-validate.yml` runs it on every pull request.

Created with the [OKForest CLI](https://github.com/okforest/cli) `company` template.
