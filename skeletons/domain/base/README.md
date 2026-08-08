# ${{ values.title }}

`${{ values.domainName }}` is a portable Contract-First IDP tenant Domain owned by
`group:default/domain-maintainers`. It contains tenant identity and lifecycle
policy, while `${{ values.platformTarget }}` supplies trusted cluster configuration.

The scaffolder publishes this repository, registers `catalog-info.yaml`, and opens a separate
platform admission pull request. After that pull request merges, Argo CD renders the Domain chart
once and creates one System discovery controller for each ordered environment.

## Environment lifecycle

`${{ values.buildEnvironment }}` is the build environment and must remain first.

| Environment | Namespace suffix |
| --- | --- |
{% for environment in values.environments -%}
| `${{ environment.name }}` | `${{ environment.namespaceSuffix | default("none", true) }}` |
{% endfor %}

The target owns router, Schema Registry, Quay, Argo CD, chart, SCC, and cluster-local Secret
coordinates. This repository can therefore be attached to another compatible target without
rewriting tenant policy.

## Git contract

| Path | Meaning |
| --- | --- |
| `catalog-info.yaml` | Domain identity, owner, target reference, group ID, and lifecycle policy |
| `systems/<system>/environments/<environment>.yaml` | Activate one System in one environment |

Every generated repository is public by default and protects `main` for pull-request changes,
force-push prevention, deletion prevention, and administrator enforcement. The GitHub organization
must already have the CF-IDP GitHub App installed and contain the `domain-maintainers`,
`domain-contributors`, and `domain-viewers` teams.
