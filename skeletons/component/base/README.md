# ${{ values.componentName }}

${{ values.description }}

| Attribute | Value |
| --- | --- |
| System | `${{ values.systemRef }}` |
| Implementation profile | `${{ values.implementationProfile }}` |
| Approved build profile | `${{ values.buildProfile }}` |
| Build service | Tekton/OpenShift Pipelines |
| Schema Registry API | `${{ values.schemaRegistryApiUrl }}` |

This repository owns implementation source and developer tooling. Runtime and build desired state
live under this Component in the parent System repository. Tekton clones this public repository
without a Git write credential.

## After Creation

1. Review and merge the Component pull request in the parent System repository.
2. Wait for the Component environment, runtime, and initial build to become healthy.
3. Confirm that the `git-<full-commit-sha>` image exists before creating a human release.

## Release and Promotion

```text
push to main
    -> build git-<full-sha>

push vX.Y.Z tag
    -> attach the human release tag to the existing image digest

Promote Component in Developer Hub
    -> update the desired release in the next environment
```

Create a release by tagging a commit that has already built successfully:

```bash
git tag -a v1.7.3 <commit> -m "Release v1.7.3"
git push origin v1.7.3
```

Creating the Git tag does not rebuild the Component. Release materialization resolves the
commit's existing `git-<full-sha>` image and adds the human tag to that digest. It is asynchronous;
wait for the tag to appear in Quay.

Creating a release does not promote an environment. After materialization succeeds, run
**Promote Component** in Developer Hub. That workflow opens a pull request to update
`components/${{ values.componentName }}/releases/<environment>.yaml` in the parent System
repository. Merging it selects the release for the next environment and starts target-local image
promotion. To roll back, select an older release through the same workflow.

The shared release guard permits an absent human tag or one already resolving to the same digest;
it rejects attempts to move an existing tag to a different artifact.

## Local Development

Use the checked-in implementation tooling so local and pipeline builds share project configuration.
Java profiles provide the Maven wrapper (`./mvnw test`); the Node.js profile uses reproducible npm
commands (`npm ci && npm test`). The `.devfile.yaml` provides the matching editor and workspace
entrypoint.

## Runtime Configuration

Runtime configuration is owned in the parent System repository:

| Path | Purpose |
| --- | --- |
| `components/${{ values.componentName }}/values.yaml` | Build and shared Component intent |
| `components/${{ values.componentName }}/environments/<environment>.yaml` | Replicas, Route, health checks, resources, environment variables, and Secrets |
| `components/${{ values.componentName }}/releases/<environment>.yaml` | Selected image tag only |

Keep runtime configuration out of release files so promotion and rollback change only the
artifact selection.

## API Dependencies

Java implementations download selected contracts from the Schema Registry during Maven
`initialize` and write them under `target/generated-resources/openapi`. Node.js keeps the same
catalog wiring and can retrieve a selected contract through the generated Registry content URL.

| Selection | Build behavior |
| --- | --- |
| `latest` | Follows the latest available Registry publication |
| Human release tag | Downloads the matching immutable Registry version |
| Exact Git SHA | Downloads the matching immutable commit publication |

`latest` can change a generated model without a Component source change. Prefer a release or SHA
for repeatable builds. Missing Registry artifacts fail the build without falling back to Git or
catalog content.

{%- if values.provided_api %}
## Provided API

| Attribute | Value |
| --- | --- |
| Catalog reference | `${{ values.provided_api.ref }}` |
| Registry group | `${{ values.provided_api.registry_group_id }}` |
| Registry artifact | `${{ values.provided_api.registry_artifact_id }}` |
| Selected version | `${{ values.provided_api.version }}` |
| Local contract | `target/generated-resources/openapi/${{ values.provided_api.contract_file }}` |
{%- endif %}

## Consumed APIs

{%- if values.consumed_apis | length > 0 %}
{%- for api in values.consumed_apis %}
### `${{ api.ref }}`

| Attribute | Value |
| --- | --- |
| Registry group | `${{ api.registry_group_id }}` |
| Registry artifact | `${{ api.registry_artifact_id }}` |
| Selected version | `${{ api.version }}` |
| Local contract | `target/generated-resources/openapi/${{ api.contract_file }}` |
| Default host property | `openapi.client.${{ api.alias }}.host=http://${{ api.name }}:8080` |

{%- if api.operations | length > 0 %}
Generated operation entry points:

{%- for operation in api.operations %}
- `${{ operation.method | upper }} ${{ operation.path }}` routes to
  `direct:${{ api.alias }}.${{ operation.operation_id }}`
{%- endfor %}
{%- else %}
No operation-specific routes were generated. Use the contract's operation IDs when adding routes.
{%- endif %}

{%- endfor %}
{%- else %}
This Component does not currently consume an API.
{%- endif %}
