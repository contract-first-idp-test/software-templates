# Template tests

The default suite is deterministic and service-free:

```bash
npm ci
npm test
```

It validates registered template contracts, renders representative skeletons locally, and checks
generated values against the sibling `developer-charts` repository. Parameter inputs live under
`test/fixtures/inputs/`; coordinated Bookinfo and cross-System data lives under
`test/fixtures/scenarios/`. These files are test data, not production catalog entities.

Helm implementation behavior belongs to `developer-charts`. The compatibility command used by
`npm test` verifies representative generated chart inputs against the sibling checkout:

```bash
DEVELOPER_CHARTS_DIR=../developer-charts npm run test:chart-compat
```

The release-boundary check fetches the configured repository at the one supported coordinated
revision and verifies that its canonical chart paths exist:

```bash
npm run test:remote-revision
```

All coordinated repository metadata targets `v1.0.0`; move that tag whenever the coordinated
release content changes.

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
references are unavailable. It also fails if the dedicated smoke Jest configuration discovers zero
tests. Register required fixture entities separately in the prepared test
Backstage installation; the production root catalog never references `test/fixtures/`. Use
`npm run test:debug` to retain dry-run output under `output/`.

CI reads `SMOKE_BACKSTAGE_URL`, `SMOKE_TEST_DOMAIN_REF`, `SMOKE_TEST_SYSTEM_REF`, and
`SMOKE_TEST_COMPONENT_REF` from GitHub Actions repository variables. If the installation requires
authentication, provide it through the `SMOKE_BACKSTAGE_TOKEN` Actions secret.

Real Registry mutation remains explicitly opt-in:

```bash
APICURIO_LIVE=1 npm run test:apicurio-live
```

Real promotion transport, when the existing live script and cluster prerequisites are available,
remains explicitly opt-in through `npm run test:promotion-live`. Neither live command is part of
`npm test`.
