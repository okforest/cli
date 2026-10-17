# okforest

The OKForest CLI: validate, inventory, and scaffold
[Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/open-knowledge-format)
v0.2 trees.

```sh
npx okforest validate .                 # exit 1 on errors; warnings never fail
npx okforest validate . --format json   # for CI and tools
npx okforest inventory .                # types, tags, keys, near-duplicates
npx okforest init sales-okf --template company --name "Sales knowledge"
```

To also check D2 and Mermaid diagram syntax, install the optional packages
alongside it:

```sh
npx -p okforest -p @d2lang/d2 -p mermaid okforest validate .
```

In GitHub Actions, use
[OKForest Validate](https://github.com/okforest/validate-action)
(`uses: okforest/validate-action@v1`): the same rules, with annotations on the
pull request and the diagram checks included.

Rules, options, and what counts as a concept: see the
[OKForest CLI README](https://github.com/okforest/cli#readme).

Apache-2.0 · © Preneur LLC · [okforest.ai](https://www.okforest.ai)
