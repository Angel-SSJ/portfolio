# Release process

Last updated: 2026-11-21.

This repository has two owner-controlled release phases. No command in this project creates a
branch, merge, GitHub Release or npm publication for the owner.

## Prepare phase

1. The owner creates a release branch locally, for example `codex/release-v0.1.0`.
2. Run `pnpm release:prepare 0.1.0` on that exact branch with a clean tree and the configured
   owner identity.
3. Preparation may change only `package.json`, `pnpm-lock.yaml` and `CHANGELOG.md`. It stops
   before any commit, tag, push or deploy.
4. The owner reviews the diff, commits with `chore: release v0.1.0`, and opens a PR. CI must pass
   before integration.

## Finalize phase

1. After local exact-head integration, keep `main` synchronized with its upstream.
2. Run `pnpm release:check`; it refuses version `0.0.0`, a dirty tree, stale remote `main`,
   missing identity, an existing tag, missing upstream or unverified CI for the exact SHA.
3. The owner creates an annotated local tag, for example `v0.1.0`, with the exact owner tagger
   identity.
4. Run `pnpm release`. It revalidates the tag and remote state, creates no commit and no file
   change, then pushes only that tag. A second run is a no-op when the same verified tag is
   already on the remote.
5. Tag-push CI performs the deployment checks. A network error or missing CI result is a
   failure, never a successful preflight.

## Rules

- The first proposed release is `0.1.0`. The initial `0.0.0` version is a setup sentinel and
  must not be released.
- Tags are strict stable SemVer (`vMAJOR.MINOR.PATCH`). Prerelease, lightweight, wrong-tagger,
  wrong-version and off-main tags are refused.
- Author, committer and tagger must all be `Angel Ramirez <angelgabriel.16ra@gmail.com>`.
- The package is private; no command publishes to npm or creates a GitHub Release here.
- Never move or delete a pushed tag. If finalization fails before the push, fix the prerequisite
  and retry. After a bad tag has been pushed, prepare a new higher stable version instead.
- Finalization uses release-it in a Git-only profile with `npm: false`, no changelog plugin,
  no commit and no platform publication. This avoids release-it's npm version-write path and
  any changelog rewrite during tag finalization.
- Fixture tests inject remote CI results. No setup command calls GitHub or mutates the real
  repository.
