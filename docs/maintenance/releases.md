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
5. Tag-push CI validates the exact tag SHA, introduced history, tagger, package version,
   main membership and the latest remote `quality` run for that SHA. A network error, missing
   result or stale failed run with no newer success is a failure, never a successful preflight.
6. Preflight compares the highest published GitHub release and the authoritative production
   version/SHA metadata, selected from the latest live READY production deployment. Only a
   confirmed empty production deployment list is a first publication; a deployment without
   usable metadata stops the release. A newer version is staged; a failed check, stale version,
   changed SHA, same-version/different-SHA conflict or inconsistent records also stop before
   deployment.
7. The tag workflow builds production output once, stages it without domain assignment,
   verifies the staged host with the Vercel REST deployment endpoint for project, production
   target and READY state, runs the full browser suite and route checks against that exact
   staged URL, then re-reads release/production state while excluding the staged deployment and
   promotes it only on a `promote` decision.
8. The same workflow records the GitHub Release from the existing tag only after promotion.
   If record publication fails, rerunning the same tag recognizes the exact deployed SHA and
   completes the missing release record without another commit, tag or promotion.

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
- Vercel Git deployment is disabled in `vercel.json`. Only this tag workflow deploys; ordinary
  main pushes run the required `quality` check and never deploy.
- There is one constant production concurrency group with `cancel-in-progress: false`. One
  release runs at a time; a pending run may be replaced and dispatch order is not a queue.
- Staged `--prod --skip-domain` deployments are excluded from production facts. This prevents
  the deployment being promoted from being mistaken for the current live deployment.
- Production facts enumerate all READY production deployments through paginated Vercel REST
  results. An ambiguous non-empty result with no valid live deployment stops the release.
- `VERCEL_TOKEN` is exposed only to individual Vercel steps. `VERCEL_PROJECT_ID` and
  `VERCEL_ORG_ID` are read as non-secret GitHub variables through the `vars` context, not
  embedded in commands or checked-in files. `checks: read` is granted only where the workflow
  queries `quality` check runs.
- `contents: write` is granted only to the release-record job after promotion. Validation and
  deployment jobs use read-only contents.

## Rollback

Rollback is a deliberate production operation outside this workflow. Record the deployed
SHA/version separately from the latest Git version and GitHub Release. After a manual rollback,
pause further releases and reconcile the authoritative production version/SHA with the release
record; the promotion guard will reject a stale or same-version/different-SHA candidate until
that reconciliation is complete. Never create a new commit or tag to paper over a mismatched
deployment.

## Verification status

Actionlint, workflow wiring review, policy fixtures and local health are run locally before
publication. No setup task triggers GitHub Actions, creates a real tag/release, calls
`vercel deploy`, or promotes anything; the real deployment path remains explicitly unexecuted
until an owner follows this release flow.
