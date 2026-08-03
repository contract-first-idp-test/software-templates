# ${{ values.componentName }}

${{ values.description }}

| Attribute | Value |
| --- | --- |
| System | `${{ values.systemRef }}` |
| Implementation | `${{ values.implementationProfile }}` |
| Build | Tekton/OpenShift Pipelines |
| Schema Registry API | `${{ values.schemaRegistryApiUrl }}` |

This repository owns implementation source and developer tooling. Runtime and build intent live
under this Component in the parent System desired-state repository. Tekton clones this public
repository without a Git write credential.

## After creation

1. Review and merge the Component pull request in the parent System repository.
2. Wait for the Component environment, runtime, and initial build to become healthy.
3. Confirm that the `git-<full-commit-sha>` image exists before creating a human release tag.

## Work locally

Use the checked-in Maven wrapper so local and pipeline builds use the same project configuration:

```bash
./mvnw test
./mvnw package
{% if 'quarkus' in values.implementationProfile %}./mvnw quarkus:dev{% else %}./mvnw spring-boot:run{% endif %}
```

The `.devfile.yaml` provides the corresponding editor and workspace entrypoint.

## Build and release

Main commits publish `git-<full-commit-sha>` and update the build environment's floating `latest`.
A human Git tag creates a release tag on that already-built digest:

```bash
git tag -a v1.7.3 <commit> -m "Release v1.7.3"
git push origin v1.7.3
```

Release materialization is asynchronous and does not promote an environment. After the Quay tag is
available, use **Promote Component** in Backstage. The current materialization task does not guard
against moving an existing human tag; enforce immutability through Quay or release policy. Rollback
promotes an older release through the same workflow.

Runtime replicas, resources, Secrets, health checks, and Route configuration belong in System
common or environment values, never in release overlays.

## API contracts

Maven downloads selected contracts from the enterprise Apicurio Registry during `initialize` and
writes them under `target/generated-resources/openapi`. Reviewable selections live in
`api-dependencies.yaml`.

| Selection | Build behavior |
| --- | --- |
| `latest` | Follow the latest available Apicurio publication |
| Human release tag | Download the matching immutable Registry version |
| Exact Git SHA | Download the matching immutable commit publication |

`latest` can change a generated model without a Component source change. Prefer a release or SHA
for repeatable builds. A selected API must complete initial publication; missing Registry artifacts
fail the build without falling back to Git or catalog content.

{% if values.provided_api %}
## Provided API

| Attribute | Value |
| --- | --- |
| Catalog reference | `${{ values.provided_api.ref }}` |
| Registry group | `${{ values.provided_api.registry_group_id }}` |
| Registry artifact | `${{ values.provided_api.registry_artifact_id }}` |
| Selected version | `${{ values.provided_api.version }}` |
| Local contract | `target/generated-resources/openapi/${{ values.provided_api.contract_file }}` |
{% endif %}

## Consumed APIs

{% if values.consumed_apis | length > 0 %}
{% for api in values.consumed_apis %}
### `${{ api.ref }}`

| Attribute | Value |
| --- | --- |
| Registry group | `${{ api.registry_group_id }}` |
| Registry artifact | `${{ api.registry_artifact_id }}` |
| Selected version | `${{ api.version }}` |
| Local contract | `target/generated-resources/openapi/${{ api.contract_file }}` |
| Default host property | `openapi.client.${{ api.alias }}.host=http://${{ api.name }}:8080` |

{% if api.operations | length > 0 %}
Generated operation entry points:

{% for operation in api.operations %}
- `${{ operation.method | upper }} ${{ operation.path }}` routes to
  `direct:${{ api.alias }}.${{ operation.operation_id }}`
{% endfor %}
{% else %}
No operation-specific routes were generated. The contract and client host configuration are
available; add a route using the contract's operation IDs when needed.
{% endif %}

{% endfor %}
{% else %}
This Component does not currently consume an API.
{% endif %}
