# Setup status

Last updated: 2026-11-21 (America/Guatemala).

This file distinguishes observed local state from planned or external state. It is
updated as the foundation is built; do not treat planned items as verified.

## Observed local state

- Repository: `https://github.com/Angel-SSJ/portfolio.git`, branch `main`, no commits yet
  at the start of foundation work.
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
- No release tags, GitHub Releases or deployments have been created.

## Planned or pending state

- Formatting/linting tooling, Starwind tokens/theme, hooks/commit policy, owner-controlled
  release tooling, browser tests and `pnpm health`: complete locally (Tasks 2–6).
- Branch CI with the required `quality` job and tag-only deployment workflow: complete
  locally (Task 7). `vercel.json` disables Vercel Git deployments.
- Workflow validation uses pinned actionlint 2.0.6 through `pnpm check:workflows`; Vercel CLI
  66.6.0 is pinned but no deployment command has been executed.
- Local checks validate guards and configuration only. No real GitHub Actions run, release
  tag, GitHub Release or production promotion is claimed.
- GitHub branch protection, Vercel project linking, CI variables/secrets and final external
  verification: pending Task 8 (requires owner authorization).
