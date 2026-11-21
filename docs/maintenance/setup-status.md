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

- Formatting/linting tooling: complete (Task 2); approved plan/spec docs under
  `docs/superpowers/` are intentionally excluded from Biome to keep them verbatim.
- Starwind tokens and theme control: complete locally (Task 3). Theme prepaint and
  persistence behavior still needs browser verification in Task 6; it is not claimed here.
- Git hooks and commit policy: pending Task 4.
- Owner-controlled release tooling: pending Task 5.
- Browser tests and the health command: pending Task 6.
- GitHub Actions CI and deployment workflow: pending Task 7.
- GitHub branch protection and Vercel project linking: pending Task 8 (external).
