# Release and compatibility

Contract-First IDP repositories version their own contracts independently:

```text
software-templates -> developer-charts -> platform-components
software-templates ----------------------> platform-components
```

Software Templates owns the developer-facing golden paths and generated repository structures.
Its root `release.yaml` declares compatible platform-components and developer-charts ranges. A
patch repairs forms, expressions, validation, generated documentation, or presentation without
changing those ranges. A minor may add a golden-path capability and raise dependency floors. A
major denotes an incompatible generated-repository or lifecycle contract requiring migration.

Every golden path resolves its PlatformTarget, then runs the same Roadie JSONata compatibility
gate before any workspace render, repository publication, or pull request. The existing plugin is
used because RHDH exposes it already; no custom backend plugin is required. Repository tests use
the standard `semver` package to validate metadata ranges and tie the embedded gate to those exact
ranges.

Ranges state compatibility; tags select code. For example:

```yaml
requires:
  platformComponents: ">=1.1.0 <2.0.0"
  developerCharts: ">=1.0.0 <1.1.0"
```

accepts chart patch `1.0.9`, but a PlatformTarget still pins one exact revision such as `v1.0.1`.
Developer Hub likewise discovers this repository through an exact tag such as `v1.1.0`.

An installation can independently run platform-components 1.1.3, developer-charts 1.0.4, and
software-templates 1.1.2. A template-only `1.1.3` patch keeps both ranges and requires no platform
or chart release. An additive sequence may instead introduce platform-components 1.2.0, then
developer-charts 1.1.0 requiring it, then software-templates 1.2.0 requiring both new capabilities.
