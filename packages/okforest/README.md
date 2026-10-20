# okforest

The OKForest CLI: validate, inventory, and scaffold
[Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/open-knowledge-format)
v0.2 trees.

```sh
npx okforest validate .                 # exit 1 on errors; warnings never fail
npx okforest validate . --format json   # for CI and tools
npx okforest inventory .                # types, tags, keys, near-duplicates
npx okforest init sales-okf --template company --name "Sales knowledge"
npx okforest rule okf/type              # why a rule exists, and how to fix it
```

`npx` runs it without installing anything. It needs Node.js 22 or later. To
run `okforest` directly, install it globally; in a repository, add it as a
development dependency instead, so everyone and CI run the same version:

```sh
npm install --global okforest
npm install --save-dev okforest
```

To also check D2 and Mermaid diagram syntax, install the optional packages
alongside it:

```sh
npx -p okforest -p @d2lang/d2 -p mermaid okforest validate .
npm install --save-dev okforest @d2lang/d2 mermaid   # or in a repository
```

In GitHub Actions, use
[OKForest Validate](https://github.com/okforest/validate-action)
(`uses: okforest/validate-action@v1`): the same rules, with annotations on the
pull request and the diagram checks included.

Rules, options, and what counts as a concept: see the
[OKForest CLI README](https://github.com/okforest/cli#readme).

Apache-2.0 · © Preneur LLC · [okforest.ai](https://www.okforest.ai)
