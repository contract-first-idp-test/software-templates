# Template tests

The default suite is deterministic and service-free:

```bash
npm ci
npm test
```

It validates registered template contracts and renders representative skeletons locally. Component
profiles use the `basic` and `cross-system` scenarios; the latter covers provider-owned Registry
coordinates, duplicate operation IDs, human and exact-SHA pins, and a wiring-only API.

Helm implementation behavior belongs to `developer-charts`. The compatibility command verifies
representative generated chart inputs against a supplied `developer-charts` checkout:

```bash
DEVELOPER_CHARTS_DIR=../developer-charts npm run test:chart-compat
```

The generated Maven baselines can be compiled separately when Maven repositories are reachable:

```bash
npm run test:build
```

## Live Backstage smoke tests

The smoke suite sends one representative dry-run request for Domain, System, API, Component,
Resource, and promotion. It exercises Backstage template rendering only; it does not execute Git,
Tekton, Apicurio, Argo CD, or image promotion.

```bash
cp test/.env.example test/.env
npm run test:smoke
```

The command fails immediately and lists missing configuration if the live Backstage URL and catalog
references are unavailable. The sample entities under `samples/` are disabled in the root catalog;
register the required smoke fixtures separately in the target Backstage installation. Use
`npm run test:debug` to retain dry-run output under `output/`.

Real Registry mutation remains explicitly opt-in:

```bash
APICURIO_LIVE=1 npm run test:apicurio-live
```

Real promotion transport, when the existing live script and cluster prerequisites are available,
remains explicitly opt-in through `npm run test:promotion-live`. Neither live command is part of
`npm test`.
