# ${{ values.api_id }} API

This repository owns one complete OpenAPI contract in `specification.yaml`. Git is the
authoritative contract source; the Schema Registry contains validated, immutable publications of
Git revisions.

## After creation

1. Review and merge the API pull request in the parent System repository.
2. Wait for the API Application and initial publication PipelineRun to succeed.
3. Verify the commit-SHA version in the Schema Registry before selecting this API in a Component.

## Contract contents

The repository was created from either:

- an uploaded, self-contained OpenAPI YAML or JSON document; or
- the golden path's minimal OpenAPI 3.1 scaffold.

The golden path preserves uploaded contract content exactly. Spectral validates structure,
metadata, operation identifiers, and platform governance before Registry publication. Internal
`#/...` references are supported. Relative references to files outside the uploaded document are
not.

## Publication coordinates

| Coordinate | Value |
| --- | --- |
| Registry group | `${{ values.registryGroupId }}` |
| Registry artifact | `${{ values.api_id }}` |
| Registry API | `${{ values.schemaRegistryApiUrl }}` |

The Maven POM configures the official Apicurio Registry Maven plugin. The System-owned Pipeline
validates the initial revision and every later main push, then publishes a Registry version named
with the exact Git commit SHA.

An API becomes consumable only after initial publication succeeds. Generated Components do not
fall back to Git or catalog content when the selected Registry artifact is absent.

## Create a human release

Push a tag using `v<major>[.<minor>[.<patch>]][-<prerelease>]`, for example:

```bash
git tag -a v2.1.3 <commit> -m "Release v2.1.3"
git push origin v2.1.3
```

Tekton resolves the tagged commit, publishes or finds its SHA version, then creates the distinct
immutable Registry version `v2.1.3`. OpenAPI `info.version` remains contract metadata; it does not
declare the Registry release.

## Publish locally

Supply an explicit version and collision policy:

```bash
mvn io.apicurio:apicurio-registry-maven-plugin:3.2.5:register \
  -Dregistry.version=<registry-version> \
  -Dregistry.ifExists=FIND_OR_CREATE_VERSION
```

Publication uses the Maven plugin directly. The repository contains no custom Registry client or
downloaded CLI.

## Version-selection guidance

Generated Components can use:

| Selection | Behavior |
| --- | --- |
| `latest` | Follow the latest available Registry publication |
| Human release tag | Retrieve one immutable named release |
| Exact 40-character Git SHA | Retrieve one immutable commit publication |

Prefer immutable selections for repeatable builds.
