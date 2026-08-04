# Development and testing

Use this guide when changing a Backstage template, generated skeleton, or template-to-chart
contract.

## Prerequisites

- Node.js and npm
- Sibling `developer-charts` and `platform-components` checkouts only for manual compatibility
  testing
- Maven repository access only when compiling generated Java baselines
- A Backstage instance only for opt-in smoke tests

## Fast feedback

Install locked dependencies and run the deterministic suite:

```bash
npm ci
npm test
```

The default command runs only repository-local Jest suites:

| Suite | Command | Covers |
| --- | --- | --- |
| Repository contracts | `npm run test:contracts` | Registered templates, metadata, actions, and file contracts |
| Skeleton rendering | `npm run test:skeletons` | Representative generated repositories and profile-specific output |
| Coordinated compatibility | `npm run test:compatibility` | Root target, generated values, consumers, schemas, and canonical chart paths |

`npm test` does not require sibling repositories, a live Backstage instance, cluster, or Schema
Registry. GitHub Actions currently runs this repository-local command only.

## Template-to-chart compatibility

Use this standard workspace layout:

```text
workspace/
├── platform-components/
├── software-templates/
└── developer-charts/
```

Render representative generated values and verify their active consumers against both siblings:

```bash
DEVELOPER_CHARTS_DIR=../developer-charts \
PLATFORM_COMPONENTS_DIR=../platform-components \
npm run test:compatibility
```

Compatibility checks are manual and are not run by repository-local CI for now.

Use this whenever changing a generated Domain entrypoint, System discovery file, Component values,
Resource values, or any chart value passed by a template.

Verify the configured released revision separately:

```bash
npm run test:remote-revision
```

When publishing the next coordinated release, create a new immutable tag, update the platform
contract to it, and let the remote check consume that declaration. Do not move an existing tag.

Helm implementation behavior belongs in `developer-charts`; this repository verifies the producer
side of the shared contract.

## Generated Java baselines

Compile all generated Component profiles when Maven repositories are reachable:

```bash
npm run test:build
```

This test is intentionally separate from `npm test` because it downloads external build
dependencies.

## Live Backstage smoke tests

Create local configuration, then run representative creation and promotion dry-runs:

```bash
cp test/.env.example test/.env
npm run test:smoke
```

The suite exercises Backstage rendering only. It does not execute Git mutations, Tekton,
Apicurio, Argo CD, or image promotion. Required fixture entities under `test/fixtures/scenarios/`
must be registered separately in the live test environment; production catalog metadata never
references the fixture tree. System environment
activation is not currently covered by the smoke suite.

Retain dry-run workspaces for troubleshooting:

```bash
npm run test:debug
```

Generated output is written under `output/`. Remove it with `npm run clean`. Never commit
`test/.env`.

## External-service checks

The following commands make real external calls and are never part of the default suite:

```bash
APICURIO_LIVE=1 npm run test:apicurio-live
npm run test:promotion-live
```

Run them only in an explicitly prepared environment with the required service and cluster access.

## Change checklist

- Keep template and skeleton paths relative to the registered template source.
- Preserve the distinction between tenant SCM annotations and platform chart coordinates.
- Add or update a deterministic contract test for every generated Git signal.
- Run `npm test`.
- Run `npm run test:compatibility` with both sibling checkouts when a coordinated contract changes.
- Run `npm run test:build` when a generated Java profile or POM changes.
- Update the root README or architecture guide when a golden path, trust model, or lifecycle
  changes.
