# Foundation architecture

Last updated: 2026-11-21.

## Static application

- `src/pages/` contains only the neutral index and 404 pages. Astro builds them with
  `output: 'static'`; there is no SSR adapter, server island or client router.
- `src/layouts/BaseLayout.astro` owns the document shell, imports the single CSS entry and
  renders the Starwind theme initializer in `<head>`. Its props are `title?` and
  `description?`; page content goes in the default slot.
- `src/config/site.ts` validates non-secret site metadata through `astro/zod`. No canonical
  URL is emitted until a real site URL is configured.

## Tool ownership

| Tool                     | Owns                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Astro check / TypeScript | `.astro` files and typed sources, scripts and tests via `tsconfig.json`               |
| Biome                    | Stable JS/TS/JSON/CSS/Markdown/YAML formatting and linting (not `.astro`, not README) |
| Prettier + Astro plugin  | `.astro` formatting only                                                              |
| ESLint + Astro plugin    | `.astro` templates, frontmatter and accessibility                                     |
| Starwind CLI             | `starwind.config.json`, `src/styles/starwind.css`, `src/components/starwind/`         |
| actionlint               | GitHub workflow semantics                                                             |

The approved plan and spec under `docs/superpowers/` are archival records and are excluded
from Biome formatting so their text stays verbatim. `README.md` is not created or edited in
this phase.

## Editable design tokens

All appearance changes belong in the clearly marked `EDITABLE DESIGN TOKENS` area of
`src/styles/starwind.css`:

- `:root` holds light values; `.dark` holds dark overrides.
- `@theme inline` maps Starwind semantic names (surfaces, foregrounds, primary/secondary/
  accent/muted, status colors, border/input/outline, radii, font and shadows) to Tailwind
  v4 utilities.
- Keep color/foreground pairs together and prefer inherited Tailwind scales over a second
  palette. Component files under `src/components/starwind/` should not be edited for brand
  colors.
- Reduced-motion handling is in the media query at the end of the stylesheet.

## Theme control boundary

`ThemeInitScript` in the layout head applies the saved or system theme before paint. The
`Tema` select in `src/components/theme/ThemeSelect.astro` is a thin native adapter over
Starwind's `initThemeController()` using the same options from `src/config/theme.ts`
(`colorTheme`, `system`, `.dark`). It does not implement a second storage mechanism. Browser
behavior is verified by the Playwright suite; rendered-string tests only check markup.

## Why the Container API is experimental

Component contracts use Astro's `experimental_AstroContainer`, which is pinned with Astro.
Upgrades must rerun the render tests; these tests do not replace client/browser verification.

## Commit and hook policy

`pnpm hooks:install` installs the Lefthook hooks and patches the generated `pre-commit` wrapper
with `--no-stage-fixed`. Lefthook 2.2.2 otherwise saves, stashes, reverts and restores partially
staged files for every pre-commit hook. This project never enables `stage_fixed`, fixers or
`git add` in a hook, so that guard is disabled explicitly. Do not replace `hooks:install` with a
raw `lefthook install`.

Pre-commit checks the current working-tree bytes of staged paths with their owning tools. An
unstaged invalid edit in the same file can therefore block a commit, but it is never staged.
`commit-msg` validates the actual message file with commitlint; `pre-push` validates every pushed
commit range and runs lightweight type and unit gates. `LEFTHOOK=0` bypasses hooks locally and is
only for deliberate diagnosis; CI repeats the same checks in Task 7.

Future integration merges stay local: create the merge commit locally with the exact owner
identity and a conventional message, validate the full `base..HEAD` range, and never push a merge
created by a hosting-provider button.
