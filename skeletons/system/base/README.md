# ${{ values.systemName }} System

This repository owns the `${{ values.systemName }}` System catalog entity and its GitOps desired
state. The parent Domain repository separately determines which environments activate this System.

## After creation

1. Review and merge the activation pull request in the parent Domain repository.
2. Wait for the System Application and namespace to become healthy in the build environment.
3. Use the API, Component, and Resource golden paths to add capabilities.

## Repository contract

| Path | Responsibility |
| --- | --- |
| `apis/<name>/values.yaml` | Configure OpenAPI validation and Schema Registry publication |
| `components/<name>/values.yaml` | Hold Component values shared across environments |
| `components/<name>/environments/<environment>.yaml` | Configure runtime behavior and create environment-local registry infrastructure |
| `components/<name>/releases/<environment>.yaml` | Select one versioned Component artifact |
| `resources/<profile>/<name>/values.yaml` | Hold common managed-Resource intent |
| `resources/<profile>/<name>/environments/<environment>.yaml` | Provision a Resource in one environment |

File presence is meaningful. A Component can have configuration before a release exists, and a
Resource is provisioned only in environments with a corresponding environment file.

## Safe changes

- Put shared Component behavior in common values.
- Put environment-specific behavior in environment values.
- Keep release files limited to `image.tag`.
- Use the Backstage promotion golden path to change a release selection.
- Use the Resource golden path to add managed dependencies.

Argo CD layers common, environment, and release values without rewriting team-owned configuration.
Rollback selects an older release tag through the same promotion pull-request workflow.

## Catalog and documentation

The root catalog contains the System entity. API, Component, and Resource entities live in their
own repositories and relate back to this System through Backstage catalog references.
