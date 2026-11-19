/**
 * The repository `okforest init` creates: an empty OKF bundle in `okf/`,
 * set up as the company knowledge template is
 * (https://github.com/okforest/template-company-knowledge), whose CI,
 * Dependabot, `.gitignore`, and Betterleaks files these copy as they are.
 * Kept here rather than as files in the package, since npm leaves
 * `.gitignore` files out of packages.
 */

/** The bundle's folder in the repository. */
export const BUNDLE = "okf"

/** The files of a new repository, by path. */
export function starterFiles(name: string, date: string): Record<string, string> {
  // A JSON string is also a valid YAML double-quoted scalar.
  const yamlName = JSON.stringify(name)
  return {
    ".github/dependabot.yaml": DEPENDABOT,
    ".github/workflows/ci.yaml": CI,
    ".gitignore": GITIGNORE,
    ".betterleaks.toml": BETTERLEAKS,
    "AGENTS.md": `# AGENTS.md

<!-- Started by \`okforest init\`. Make it yours: add how your team works with
this repository, and remove anything that doesn't apply. -->

${name}: an [OKF 0.3](https://github.com/open-knowledge-format/open-knowledge-format)
bundle in \`okf/\`, managed with [OKForest](https://www.okforest.ai). People
read it to learn; AI assistants use it to answer questions. Write for both.

Everything outside \`okf/\` (this file, \`README.md\`, \`.github/\`,
\`.betterleaks.toml\`) is repository setup, not knowledge. Commands below run
from the repository root.

## Before you finish

- \`npx okforest validate okf\` must report no errors. Fix warnings you
  introduced. \`npx okforest rule <rule>\` explains any finding.
- Pull requests run a secret scan and the same validation
  (\`.github/workflows/ci.yaml\`). The scan checks the whole git history, so a
  secret must never be committed, even briefly.

## Writing concepts

- One concept per file, in the folder for its area. File and folder names
  are lowercase slugs: \`refund-policy.md\`.
- Start new pages from their type's template:
  \`npx okforest new <Type> <path> --root okf --title "…" --description "…"\`.
  The path is inside \`okf/\`, e.g. \`policies/refunds.md\`.
- Use the types defined in \`okf/.okforest/types/\`, spelled exactly (\`Policy\`,
  not \`policy\`). If none fits, add a schema and template in the same change
  and say why. Check \`npx okforest inventory okf\` before adding a type or
  tag, to reuse an existing one.
- Every concept has a \`title\` and a one-sentence \`description\`. New or
  unreviewed pages are \`status: draft\`.
- Link with standard markdown links, using absolute paths from the bundle
  root (\`okf/\`): \`[refunds](/policies/refunds.md)\`.
- \`index.md\` and \`log.md\` are reserved names in every folder. Keep each
  folder's \`index.md\` up to date when you add, rename, or remove a page, and
  give a new folder its own \`index.md\`, listed in its parent's. Record notable
  changes in \`okf/log.md\` under a \`## YYYY-MM-DD\` heading, newest first.

## Accuracy

- Don't invent facts. If something is unknown, leave the guidance comment in
  place and ask, rather than filling it in with a guess.
- When content comes from a document or site, cite it in \`sources\` and use
  footnotes in the body.
- When you write content, set \`generated: { by: <agent>/<version>, at: <time> }\`.
  Never add a \`verified\` entry for a person (\`human:…\`); only that person
  can do that.

## Secrets and personal data

- **Never write:** passwords, API keys, tokens, private keys, recovery codes,
  bank account or routing numbers, card numbers, or anyone's government ID
  number.
- **Instead,** record where a secret is kept (its password manager, vault,
  and item), never the secret itself.
- **Keep personal data out:** no home addresses, personal phone numbers, pay,
  performance reviews, or health information. Work names, job titles, and
  roles are fine.
- If you find a secret already in the repository, don't just delete it: it
  stays in the git history. Tell a person so it can be rotated.
`,
    "README.md": `# ${name}

${name}: an [Open Knowledge Format (OKF)](https://github.com/open-knowledge-format/open-knowledge-format)
0.3 bundle in [\`okf/\`](okf/index.md), one markdown file per concept, with
YAML frontmatter. Start at [\`okf/index.md\`](okf/index.md).

## Getting started

<!-- Delete this section once setup is done. -->

This repository was started with \`okforest init\`, which makes an empty tree.
For a company's knowledge, the
[company knowledge template](https://github.com/okforest/template-company-knowledge)
starts with its folders, types, and draft pages instead.

- [ ] Say what this knowledge covers, above, and in \`description\` in
      \`okf/.okforest/settings.yaml\`.
- [ ] Add a folder for each area, with its own \`index.md\`, listed in
      \`okf/index.md\`.
- [ ] Define your types: a schema and a template for each, in
      \`okf/.okforest/types/\` ([Types](https://www.okforest.ai/docs/types/)).
- [ ] In the repository's settings, require the **Scan and Validate** check
      before merging to \`main\`.
- [ ] Delete this section.

## Layout

| Path | What it holds |
|---|---|
| \`okf/\` | The knowledge: one markdown file per concept |
| \`okf/.okforest/\` | OKForest settings, and each type's schema and template |
| \`AGENTS.md\` | Instructions for AI agents editing this repository |
| \`.github/\` | CI (secret scan and validation on every pull request) and Dependabot |

## Working with it

\`\`\`sh
# Add a page, from its type's template when it has one
npx okforest new Policy policies/refunds.md --root okf \\
  --title "Refunds" --description "When we give money back, and how."

# Check the bundle
npx okforest validate okf

# List the types, tags, and fields in use
npx okforest inventory okf
\`\`\`

New pages are drafts (\`status: draft\`): fill them in and mark them \`stable\`.
Never commit secrets; record where each is kept instead.
`,
    [`${BUNDLE}/index.md`]: `---
okf_version: "0.3"
---

# ${name}

<!-- List each folder and concept here, one a line:
* [Title](folder/index.md) - One sentence on what it holds. -->
`,
    [`${BUNDLE}/log.md`]: `# Log

## ${date}

* **Creation:** Started an empty tree with \`okforest init\`.
`,
    [`${BUNDLE}/.okforest/settings.yaml`]: `# yaml-language-server: $schema=https://www.okforest.ai/schemas/settings.schema.json
# OKForest's settings for this bundle (an OKForest convention, not part of OKF).
# Every setting is optional: https://www.okforest.ai/docs/settings/
name: ${yamlName}
# description: What this bundle covers, in up to 4,000 characters.
`,
  }
}

const CI = `name: CI

on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

env:
  # Pinned to the stable v1 line; Dependabot doesn't track this, so bump it by
  # hand: https://github.com/betterleaks/betterleaks/releases
  BETTERLEAKS_VERSION: "1.10.1"

jobs:
  check:
    name: Scan and Validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          # Full history, so the secret scan sees every commit, not just the
          # latest files.
          fetch-depth: 0

      - name: Install Betterleaks
        run: |
          set -euo pipefail
          base="https://github.com/betterleaks/betterleaks/releases/download/v\${BETTERLEAKS_VERSION}"
          archive="betterleaks_\${BETTERLEAKS_VERSION}_linux_x64.tar.gz"
          curl -sSfLO "\${base}/\${archive}"
          curl -sSfLO "\${base}/checksums.txt"
          grep " \${archive}\\$" checksums.txt | sha256sum -c -
          tar -xzf "\${archive}" betterleaks
          sudo mv betterleaks /usr/local/bin/
          betterleaks version

      # Secrets first: a leaked secret must be rotated, whatever else is wrong.
      # Fails the job if anything is found; --redact keeps secrets out of the log.
      - name: Scan for Secrets
        run: >-
          betterleaks git .
          --config .betterleaks.toml
          --redact --verbose
          --no-banner --no-color

      # Runs only after the scan passes (GitHub's default: a failed step stops
      # the job). Validation messages can quote a page's values (e.g. "got
      # \`…\`"), which would put a secret in the log and annotations, where it
      # outlives a history rewrite. Fixing a secret takes another push anyway.
      # Annotates each finding on its file and line, lists them in the job
      # summary, and checks D2 and Mermaid diagrams. Fails on OKF errors;
      # warnings don't fail. https://github.com/okforest/validate-action
      - name: OKForest Validate
        uses: okforest/validate-action@v1
        with:
          path: okf
`

const DEPENDABOT = `version: 2
updates:
  # Keeps the actions in .github/workflows/ (checkout, OKForest Validate)
  # up to date. The Betterleaks version in ci.yaml is a plain variable,
  # which Dependabot doesn't track: bump it by hand.
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
    groups:
      github-actions:
        patterns: ["*"]
    open-pull-requests-limit: 10
`

const GITIGNORE = `.DS_Store
node_modules/
`

const BETTERLEAKS = `# Betterleaks config: the built-in rules plus one for passwords written in text.
# Loaded with --config by .github/workflows/ci.yaml; Betterleaks does not load
# this file automatically.
[extend]
useDefault = true

# The built-in generic-password rule expects code or config ("password = x").
# This one also catches how people write passwords in markdown: in prose
# ("the password is x"), bold labels ("**Password:** x"), table cells
# ("| password | x |"), and after a dash ("password — x").
[[rules]]
id = "prose-password"
description = "A password written out in text (keep it in a password manager and record where instead)"
regex = '''(?i)\\bpass(?:word|phrase|code)s?\\b[^\\n|]{0,30}?(?:\\bis\\b|:|=|—|–|\\|)[\\s*_|]*["'\`]?([^\\s"'\`*|]{8,})'''
secretGroup = 1
entropy = 3.0
keywords = ["password", "passphrase", "passcode"]
# A link or a path after "password:" is where to go, not the password.
filter = '''
matchesAny(finding["secret"], [\`^/\`, \`://\`])
'''
`
