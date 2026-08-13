# Release and compatibility model

The repositories remain independently versioned:

```text
software-templates -> developer-charts -> platform-components
software-templates ----------------------> platform-components
```

`software-templates` owns the developer-facing golden paths and generated repository structures.
Root `release.yaml` is authoritative:

```yaml
version: 1.0.0
requires:
  platformComponents: ">=1.0.0 <2.0.0"
  developerCharts: ">=1.0.0 <2.0.0"
```

Every golden path fetches the PlatformTarget and runs
`contract-first-idp:validate-compatibility` before rendering a workspace, creating a repository,
or opening a pull request. The action and release validator use `node-semver`. Compatibility steps
are generated from `release.yaml`; stale generated steps fail the release gate.

A patch fixes implementation behavior and must preserve both ranges exactly. A minor adds capability
and may raise either dependency minimum. A major is an incompatible golden-path or generated
repository contract change. A patch release in one repository does not require a release in another
repository when the existing compatibility ranges already include it.

`release-candidates.json` records the exact sibling revisions used by the cross-repository release
proof; it does not replace the compatibility ranges. The first release checks all three `1.0.0`
candidates together. Future scenarios such as independent `1.0.1` patches or additive `1.1.0`
capabilities remain test fixtures until real releases are intentionally cut.

## Release procedure

1. Decide this repository's SemVer from changes to its golden-path contract.
2. Update `release.yaml`.
3. Run `npm run --prefix test generate:compatibility` to refresh derived steps.
4. Update `release-candidates.json` to the exact sibling candidates under test.
5. Run `make release-check`, which includes the full suite and cross-repository compatibility.
6. Commit and push the verified release candidate.
7. Create and push the exact `vX.Y.Z` tag.
8. Verify the tag-triggered GitHub Actions gate.
9. Update platform configuration to the desired exact compatible template tag.

The gate rejects tag/version mismatch, non-monotonic versions, patch dependency changes, stale
generated compatibility steps, incompatible sibling candidates, and stale exact candidate
selections.
