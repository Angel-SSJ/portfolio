# Desarrollo local

Última actualización: 2026-11-22 (America/Guatemala).

## Requisitos

- Git con identidad de repositorio: `Angel Ramirez <angelgabriel.16ra@gmail.com>`.
- Node 26.x según `.node-version` / `package.json#engines`.
- pnpm 12.21.0 según `package.json#packageManager`.

El repo incluye herramientas locales en `.tools/` para trabajo reproducible en este entorno; en un clon limpio usa Corepack o instala la versión fijada.

## Clon limpio

```bash
git clone https://github.com/Angel-SSJ/portfolio.git
cd portfolio
git config user.name "Angel Ramirez"
git config user.email "angelgabriel.16ra@gmail.com"
corepack enable
corepack prepare pnpm@12.21.0 --activate
pnpm install --frozen-lockfile
pnpm hooks:install
pnpm hooks:check
pnpm doctor
pnpm health
```

`pnpm hooks:install` aplica el parche de Lefthook para no re-stagear archivos. No uses `lefthook install` directo.

## Comandos útiles

- `pnpm dev`: servidor Astro local.
- `pnpm build`: build estática en `dist/`.
- `pnpm preview`: preview local del build.
- `pnpm format:check` / `pnpm format:write`: Biome + Prettier (`.astro`).
- `pnpm lint`: Biome + ESLint Astro/a11y.
- `pnpm typecheck`: `astro check`.
- `pnpm test:unit` / `pnpm test:integration` / `pnpm test:e2e`: suites por capa.
- `pnpm check:repo`: invariantes de estructura/config.
- `pnpm check:workflows`: actionlint sobre workflows.
- `pnpm verify`: puerta de release/checks no destructivos.
- `pnpm health`: puerta completa local.

## Actualización de dependencias

1. Actualiza versiones fijadas en `package.json`/lockfile de forma deliberada.
2. Ejecuta `pnpm install` y revisa diff del lockfile.
3. Ejecuta `pnpm health`.
4. Si cambia tooling de CI/deploy, revisa `.github/workflows/*`, `vercel.json`, scripts y docs.
5. No actives bots que creen commits automáticos. Los reportes de dependencias son operados por el owner.

## Integración local de PRs (política futura)

Cuando `main` esté protegida, el flujo es:

1. Actualizar rama desde `main`.
2. Push de rama y abrir PR.
3. Esperar CI verde del **head exacto** del PR.
4. Releer/revalidar head y base del PR; si cambian o falta check verde, abortar.
5. Integrar localmente: `git merge --ff-only <sha-verificado>`.
6. Push normal a `main` y observar CI del SHA exacto.

No usar merge por UI/CLI de GitHub, update-branch, revert, auto-merge ni bots: la política exige autor/committer/tagger exactos `Angel Ramirez <angelgabriel.16ra@gmail.com>`. Un merge commit persistente local debe pasar antes la misma CI de la rama fuente.

## Límites

- No editar `README.md` en esta fase.
- No crear tags, GitHub Releases, deployments o promociones de producción como parte del setup.
- `vercel.json` deshabilita Git deployments; el deploy real solo ocurre por el workflow de tags.
