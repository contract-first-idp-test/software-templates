# Template tests

The default suite is deterministic and service-free:

```bash
npm ci
npm test
```

It validates repository-local template contracts and renders representative skeletons. Parameter
inputs live under `test/fixtures/inputs/`; coordinated Bookinfo and cross-System data lives under
`test/fixtures/scenarios/`. These files are test data, not production catalog entities.

Cross-repository compatibility is intentionally manual for now. Use this sibling layout:

```text
workspace/
├── platform-components/
├── software-templates/
└── developer-charts/
```

Then run the consumption contract and chart compatibility checks explicitly:

```bash
DEVELOPER_CHARTS_DIR=../developer-charts \
PLATFORM_COMPONENTS_DIR=../platform-components \
npm run test:compatibility
```

These checks are not part of `npm test` or repository-local GitHub Actions. They fail when the
sibling repositories are absent or incompatible.

The release-boundary check fetches the configured repository at the one supported coordinated
revision and verifies that its canonical chart paths exist:

```bash
npm run test:remote-revision
```

During release preparation, update the platform contract to the intended immutable release tag and
run this check separately. Do not move an existing release tag.

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

Real Registry mutation remains explicitly opt-in:

```bash
APICURIO_LIVE=1 npm run test:apicurio-live
```

Real promotion transport, when the existing live script and cluster prerequisites are available,
remains explicitly opt-in through `npm run test:promotion-live`. Neither live command is part of
`npm test`.
