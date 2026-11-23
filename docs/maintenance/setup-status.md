# Setup status

Last updated: 2026-11-22 (America/Guatemala).

This file distinguishes observed local state from planned or external state. It is
updated as the foundation is built; do not treat planned items as verified.

## Observed local state

- Repository: `https://github.com/Angel-SSJ/portfolio.git`, branch `main`.
- Latest foundation head observed in this workspace: `3f24422091c43331937872cf061e6755b26b4f75` (`docs: document ci and deployment guard workflow`), synced with `origin/main` at audit time.
- Git identity (repository scope): `Angel Ramirez <angelgabriel.16ra@gmail.com>`.
- Node runtime selected for this project: 26.13.1 (project-local tool directory, not a
  global default change).
- pnpm: 12.21.0 (project-local, pinned as `packageManager`).
- Astro: 7.4.13 with `output: 'static'`.
- TypeScript: 6.0.3 (latest 6.x; `@astrojs/check` 0.9.12 peers on `^5 || ^6`).
- Vitest: 5.1.1.
- Biome: 2.6.8 (JS/TS/JSON/CSS/Markdown/YAML ownership).
- Prettier: 3.10.1 with `prettier-plugin-astro` 1.1.2 (`.astro` formatting only).
- ESLint: 10.15.0 with `eslint-plugin-astro` 3.2.1 and `eslint-plugin-jsx-a11y-x` 0.2.0
  (`.astro` template/accessibility checks only).
- Starwind CLI: 3.6.0 (used from a pinned `pnpm dlx` invocation).
- `@starwind-ui/astro` / `@starwind-ui/runtime`: 1.5.0.
- Tailwind CSS and `@tailwindcss/vite`: 4.3.5.
- `README.md` is absent and remains untouched.
- No release tags or GitHub Releases observed locally (`git ls-remote --tags origin` empty at audit).

## Observed external state (owner-reported)

- GitHub Actions CI observed green for SHA `3f24422091c43331937872cf061e6755b26b4f75`: https://github.com/Angel-SSJ/portfolio/actions/runs/45081304329 (`quality` success; page annotations show 2 flaky theme contrast cases, job green).
- Vercel project linkage/configuration reported complete by owner (2026-11-22). `vercel.json` is present with `git.deploymentEnabled: false`; owner confirmed dashboard Git deployment settings are configured/disabled effectively.
- Owner reported Vercel Git integration created a Production deployment during testing; owner reported it was deleted and no active production promotion/publication remains (2026-11-22). No production URL/evidence recorded in repo.
- Owner reported GitHub Actions variables/secrets configured (names only): variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; secrets `VERCEL_TOKEN` (and `VERCEL_AUTOMATION_BYPASS_SECRET` only if applicable). Values/IDs not inspected or recorded.
- Vercel non-sensitive project identity is not recorded in repo docs by owner decision; `.vercel/project.json` remains ignored.

## Planned or pending state

- Task 8 durable docs prepared locally in this session (`development.md`, setup-status update); final close requires commit, normal push to `main`, and observed green CI for that exact final SHA.
- Apply `main` protection only after the last bootstrap push passes CI: PR required, 0 mandatory external approvals, current branch, required `quality` check, no force-push/delete, rule applies to owner with no ordinary bypass. Read back effective rules.
- Final handoff: confirm no GitHub Release, version tag, deployment promotion, or production publication occurred. First publication remains owner-controlled release flow.

## Vercel linkage notes

- `vercel.json` is versioned repo config; it does not contain account/project secrets.
- `.vercel/project.json` is local CLI linkage metadata created by `vercel link`; it is ignored and must not be committed. Record only non-sensitive project identity/connection status here.
- Vercel Git deployments are intended to be disabled (`vercel.json git.deploymentEnabled=false`). Owner reported a Git-integration Production test deployment was created and deleted; confirm dashboard Git auto-deploy is disabled/effective and no production publication remains.
