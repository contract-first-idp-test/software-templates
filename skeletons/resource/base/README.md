# ${{ values.resourceName }}

This repository represents the `${{ values.resourceName }}` `${{ values.profile }}` Resource in
the `${{ values.systemName }}` System.

## After creation

1. Review and merge the Resource pull request in the parent System repository.
2. Wait for the Resource Application and operator-managed resource to become healthy.
3. Follow the profile documentation to locate connection information and credentials.

## Ownership model

| Concern | Source of truth |
| --- | --- |
| Resource identity and documentation | This repository |
| Common deployment intent | Parent System desired-state repository |
| Environment activation and overrides | Parent System desired-state repository |
| Platform implementation | Trusted developer chart selected by the profile |

In a generated Resource repository, `docs/index.md` describes the Resource contract, connection
details, and ownership guidance.

This repository gives the Resource a stable identity and implementation extension point. The
profile documentation describes the current platform implementation and how a future
platform-supported profile could replace it.
