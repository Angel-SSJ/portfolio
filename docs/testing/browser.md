# Browser and health verification

Last updated: 2026-11-21.

## Test boundaries

- `pnpm test:unit` runs Vitest unit and rendered-component tests only.
- `pnpm test:integration` runs Vitest fixture/integration tests only.
- `pnpm test:e2e` runs Playwright against Chromium, Firefox, WebKit desktop projects and one
  mobile Chromium viewport. It starts `astro preview` locally unless `BASE_URL` is an explicitly
  allowed HTTPS deployment URL. Set `PORTFOLIO_DEPLOY_HOST` when validating a custom host.
- `pnpm verify` runs formatting, linting, types, repository invariants, unit/render tests and
  integration tests.
- `pnpm health` runs `verify`, one static build and the browser suite. It does not call release
  checks, deploy, publish or run network audits.
- `pnpm run doctor` reports local readiness without external side effects. Use
  `pnpm run doctor --external` for strict Vercel/CI/secrets diagnostics; `pnpm doctor` is pnpm's
  built-in command, so the project script needs `run`.

## Accessibility scope

The Playwright suite uses `@axe-core/playwright` on the home page, 404 page and theme states, plus
keyboard focus and reduced-motion assertions. These automated checks catch common violations only;
they do not certify full accessibility or replace manual keyboard, screen-reader and content
review.

## Release smoke boundary

`pnpm release:check` runs the read-only Task 5 metadata/remote preflight, validates an external
`BASE_URL` when supplied, and then runs the same local `health` gate. `pnpm release` calls this
aggregate once before any tag mutation. External publication readiness remains pending until the
owner authorizes Task 8.

Browser projects run with one worker both locally and in CI. Higher local concurrency caused
WebKit and mobile-Chromium timeouts under resource contention; serial execution keeps the health
gate deterministic.

The tag workflow sets `PORTFOLIO_STAGED_SMOKE=1` when testing the staged production deployment.
That mode disables traces, screenshots and video so secret-bearing browser artifacts are not
created. An optional `VERCEL_AUTOMATION_BYPASS_SECRET` adds the Vercel automation header to
Playwright and route smoke requests; it is never printed or uploaded.
