---
"@okforest/validate": patch
---

Report Mermaid diagrams whose parser needs a browser (such as flowcharts) as not checked (`okforest/diagram-unchecked`) when the validator is bundled, as in the GitHub Action, instead of as a Mermaid syntax error ("purify_default.addHook is not a function"). The check now recognizes DOMPurify by its method names, which a bundler doesn't rename.
