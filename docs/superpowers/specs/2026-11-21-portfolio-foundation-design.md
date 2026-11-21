# Portfolio foundation design

Status: approved by the user on 2026-11-21; implementation and deployment have not started.
Date: 2026-11-21 (America/Guatemala).

Requirements questions resolved, including user answer 7B. Both Git author and committer must use Angel's exact identity, including persistent merge commits. The user approved this design after clarification that styles own appearance/tokens and components/theme is only needed for a project-specific theme control. Approval authorizes the implementation plan; execution awaits the plan handoff.

## Intent

Establish a maintainable, static personal portfolio foundation with explicit ownership of formatting, linting, types, tests, commits, releases and deployments. This phase creates the building blocks and repository controls; it does not design the finished portfolio or publish its first version.

The checkout at `C:/Users/angel/projects/personal/portfolio` is empty except for Git metadata, has no commits and uses `main`. Its public GitHub remote is `https://github.com/Angel-SSJ/portfolio.git`. These observations were checked during this conversation; recheck before implementation.

## Confirmed user decisions

- Implement the foundation on `main`. Future content, data and layout work uses other branches and the release process. There is no permanent ban on feature branches or pull requests.
- Production changes only through an explicit versioned release after successful CI.
- Use Astro's latest stable release, static output, Islands Architecture, Starwind UI v3, Tailwind CSS v4, pnpm, JavaScript and TypeScript.
- Complement Biome with Prettier for `.astro` formatting and ESLint limited to Astro templates.
- Include EditorConfig, Lefthook and commitlint, Astro check, Playwright, Zod schema validation and Astro Container API.
- Keep durable technical documentation versioned. Ignore `docs/files/`, temporary research, generated files and local artifacts.
- Include local configuration, GitHub CI and the actual Vercel connection in the implementation scope. Angel performs the first publication later. Do not create a release, push a release tag or deploy any environment as part of foundation setup.
- All project, release and persistent merge commits use `Angel Ramirez <angelgabriel.16ra@gmail.com>` for BOTH author and committer (user answer 7B). Do not create commits as a bot or impersonate Angel from an automated workflow. Commit-producing steps run locally under Angel's control; CI never commits or pushes versions. Do not use GitHub's server-side merge, squash, rebase, update-branch or revert controls to create project-history commits.
- Do not create, edit, format or otherwise modify `README.md` in this phase, including indirectly through scaffold or formatter commands.

## Goals and boundaries

The result must build static files, render a minimal neutral page, demonstrate the shared layout and a small useful subset of Starwind components, support light/dark/system themes and expose one reliable repository health command.

Do not add a backend, CMS, authentication, contact delivery, analytics, a database, a frontend framework runtime, server islands, a monorepo or a full component gallery. Do not add an SSR adapter just to deploy static files. Do not manufacture portfolio content, a complete brand identity or tests whose only purpose is to satisfy an arbitrary coverage percentage.

## Approaches

1. **Owner-run release-it with tag-driven CI deployment (recommended engineering choice).** Version, changelog and release commit are prepared locally on an owner-created release branch, reviewed through a PR and integrated locally by fast-forwarding main to its exact CI-validated head. After integration, Angel creates the annotated tag from synchronized main without a new commit. CI validates the exact tag commit and owns deployment. This supports deliberate releases, protected main and exact author/committer metadata without credentials to push commits from Actions.
2. **release-please.** Its release PR workflow makes versions reviewable, but normally creates bot-authored commits and requires additional identity/process exceptions. It is unsuitable for the chosen ownership policy.
3. **semantic-release.** A good fit for automatic releases from qualifying commits. A manually dispatched variant is possible, but brings less benefit for this owner-controlled portfolio than release-it.

The user selected explicit releases and owner-controlled commits, but has not selected a release library by name. The release-it recommendation is part of this design review, not an independently confirmed user decision.

## Application architecture

Use a single Astro application with `output: 'static'` stated explicitly. Astro components render HTML by default. Starwind's native Astro adapter/runtime supplies the necessary component behavior; React, Vue and Svelte are not installed speculatively. Future framework widgets may use Astro `client:*` directives when justified.

Only create directories that contain real files. This logical structure does not authorize empty placeholders:

```text
.github/
  workflows/
    ci.yml
    deploy.yml
public/
scripts/
  doctor.mjs
  verify-repository.mjs
  verify-release.mjs
src/
  components/
    starwind/              # CLI-installed source, only used components
    theme/                 # Project theme control if the stock UI is insufficient
  config/
    site.ts                # Validated non-secret site metadata
  layouts/
    BaseLayout.astro
  lib/
    utils/                 # Preserve Starwind CLI utility paths
  pages/
    index.astro
    404.astro
  styles/
    starwind.css
tests/
  components/
  unit/
  e2e/
docs/
  architecture/
  maintenance/
  superpowers/specs/
  superpowers/plans/
.editorconfig
.gitattributes
.gitignore
.node-version
astro.config.mjs
biome.json
commitlint.config.mjs
eslint.config.mjs
lefthook.yml
package.json
playwright.config.ts
pnpm-lock.yaml
pnpm-workspace.yaml
prettier.config.mjs
starwind.config.json
tsconfig.json
vercel.json
vitest.config.ts
.release-it.json
CHANGELOG.md               # Introduced with the configured release process
```

Names under `scripts/` describe intended responsibilities; the builder may consolidate scripts that do not warrant separate files. Do not write wrappers that merely rename a package CLI. Keep framework-specific files in the locations required by their tools rather than moving every config into a generic configuration directory.

Use `@/*` for source imports. Extend Astro's strictest TypeScript preset; include handwritten config, scripts and tests in appropriate typechecking. Prefer TypeScript for application code. Keep JavaScript configuration and Node scripts in ESM and typecheck them with JSDoc/checkJs where supported. Astro check owns Astro diagnostics; add a separate scripts/tests tsconfig only if it closes a demonstrated coverage gap.

## Design system and theme contract

- Use the current Starwind Astro installation layout and CLI-maintained configuration schema. Product v3 does not mean that every package or configuration schema has version 3.
- Install Tailwind through `@tailwindcss/vite`; do not use the legacy `@astrojs/tailwind` integration or introduce a v3-style Tailwind configuration file.
- Start with Button, Card and the theme control needed by the foundation. Add components when used; keep copied Starwind source reviewable and linted.
- Keep the editable design tokens in one clearly labeled area of `src/styles/starwind.css`. Preserve Starwind semantic names for surfaces and their foregrounds, primary/secondary/accent/muted states, status colors, border/input/outline and radius.
- Define light values in `:root`, dark values in `.dark`, and Tailwind utility mappings through `@theme inline`. Define typography, spacing, radius, shadows, motion and focus tokens coherently with Tailwind v4. Prefer inherited Tailwind scales to a second independently maintained palette or spacing scale.
- Use neutral accessible defaults. Final brand colors and visual composition are deferred and must be replaceable by editing tokens, without component-level color rewrites.
- Follow system preference by default. Allow explicit light, dark and system selections and persist the preference through Starwind's shared theme controller. Initialize in the layout head before paint through Starwind's supported initializer. Avoid a second independent localStorage/theme implementation.
- Define behavior for invalid storage values, unavailable localStorage and changing system preferences. Include accessible labels, visible focus, reduced-motion behavior and browser tests for those real contracts.
- Do not introduce ClientRouter/view transitions in the foundation. If an inline-script CSP is enabled, verify the production-built theme initializer against it; do not add a policy that breaks theme initialization.

## Tool responsibility and configuration boundaries

| Owner | Files / responsibility |
| --- | --- |
| Biome | Stable JS/TS/JSON/JSONC/CSS/Markdown/YAML formatting and lint capabilities in the selected version; enable Tailwind directives parsing. Exclude `.astro` and README.md. |
| Prettier + Astro plugin | `.astro` formatting only; never format files already owned by Biome. |
| ESLint + Astro plugin | Astro template and frontmatter checks, including suitable accessibility rules; no competing generic repository JS/TS lint pipeline. |
| Astro check / TypeScript | Astro and typed-source diagnostics; build success alone is insufficient. |
| EditorConfig / Git attributes | UTF-8, LF, final newline and consistent indentation; preserve legitimate file-specific exceptions. |
| actionlint | Workflow semantics in CI; YAML formatting is not a replacement. Avoid requiring Windows users to install a global binary. |
| Repository verifier | Selected file/tool coverage, package scripts, release settings and forbidden artifacts; only add checks that protect an actual invariant. |

Validate actual peer dependencies and supported options rather than copying stale templates. The previously observed stable versions are research evidence, not an already tested lockfile. At implementation, select exact compatible package versions, a supported Node LTS (proposed Node 26) and exact pnpm version; commit the lockfile. Use frozen installs in CI and explicit pnpm dependency-build policy. Never upgrade the user's global runtime or package manager implicitly.

## Scripts and repository health

Expose understandable package commands:

- `dev`, `build`, `preview` use Astro directly.
- `format:check` checks each formatter's owned files; `format:write` fixes only those files. Neither touches README.md.
- `lint` checks Biome and Astro ESLint ownership without automatic fixes.
- `typecheck` runs Astro check and any necessary supplementary config/script checks.
- `test:unit` covers meaningful pure-code and Container render contracts through Vitest.
- `test:e2e` runs Playwright against a production build served by Astro preview. The aggregate health command builds first; standalone browser tests document their build prerequisite.
- `check:repo` verifies project configuration invariants; `check:commits` validates an explicit Git range rather than the latest commit alone.
- `doctor` reports runtime/package-manager/Git/hook setup and missing external configuration without printing secrets or claiming authenticated access that was not checked.
- `health` runs the complete deterministic local quality path: formatting, lint, typechecks, repository checks, tests, build and browser tests. A failed stage exits nonzero and identifies its owner.
- `release:prepare` prepares the next package version, lockfile metadata and changelog on an owner-created release branch without creating a tag, GitHub Release or deployment. The owner reviews/commits these changes and integrates them through a PR.
- `release:check` checks clean synchronized main, commit identity, current health and version/tag readiness without mutation. `release` is an owner-initiated release-it entry point that tags the already-merged version without updating files or creating a new commit; it is never invoked during foundation setup.

Use package commands and portable Node orchestration. Avoid Unix-only shell constructs, automatic repairs during validation, nested duplicate builds and network-sensitive vulnerability audits inside the deterministic health gate. Keep optional dependency/security reports separate and actionable.

## Commit controls and ownership

Configure Git identity at repository scope; do not change global Git configuration. Enforce conventional commit messages through commitlint, including a documented type list and conventional release message such as `chore(release): v0.1.0`. Conventional commits describe messages; they do not prove authorship or cryptographic signatures.

Validate the raw Git author name/email and committer name/email of every introduced persistent commit, including merge commits, against `Angel Ramirez` and `angelgabriel.16ra@gmail.com`. Run this alongside commitlint in CI and relevant release/pre-push checks. Fail with offending commit SHAs and field names; do not rewrite metadata automatically. A mismatch requires the owner to review and repair unmerged history locally, then rerun CI. Existing published history is never rewritten as an automatic fix. Identity metadata validation is not proof of cryptographic authorship.

GitHub may maintain temporary synthetic PR merge refs as part of its platform behavior. They are not accepted into the project's persistent branches or release tags; identity validation targets actual introduced project commits, not those platform-owned temporary objects. Avoid checking a synthetic event SHA as though it were a project commit.

Lefthook pre-commit checks staged supported files without rewriting or restaging whole files. Preserve partially staged hunks and handle filenames with spaces correctly. Commit-msg checks the actual message file. A pre-push gate can run types/unit checks; the full authoritative gate remains CI. Document clean-install hook activation, bypass limitations and an explicit doctor result.

Do not enable dependency bots that create commits or release PRs. Optional dependency reports can inform owner-run updates. Knip is optional until there is enough code for useful unused-code checks; no blanket exclusions of generated Starwind source to obtain a green result.

## Testing strategy

- Use Vitest with Astro's supported Vite configuration for Container API renders. Keep the experimental API behind a small test helper where useful, pin Astro and retest upgrades. Do not interpret rendered-string tests as proof of client behavior.
- Use Zod for real site/config/content input boundaries; reuse the supported Astro Zod export where appropriate instead of adding a redundant second dependency. No empty content collections solely to demonstrate Zod.
- Component tests verify meaningful markup, props and slots. Browser tests verify theme initialization/persistence/system behavior, navigation/404, keyboard focus and absence of page errors.
- Proposed default: Playwright Chromium, Firefox and WebKit with a small desktop/mobile viewport set; avoid multiplying every test across a large device matrix. Automated accessibility checks cover core page and theme states and do not claim full WCAG certification.
- Do not publish a UI gallery or fixture-only routes to production. Test files stay outside routable source; the minimal index page can exercise the actual shared layout and components.

## CI and future branch policy

CI runs for pushes to all real branches, including main, and for manual validation. Source-branch push checks appear on the PR and validate the exact persistent branch-head SHA that will be integrated. A separate pull_request-triggered workflow is unnecessary for the same-repository, owner-only baseline; do not rely on synthetic merge-ref checks to validate owner metadata. Install pinned tooling with a frozen lockfile, run formatting/lint/types/repository checks, unit/render tests, static build and browser tests. Validate every introduced commit, handling the initial root commit, multi-commit pushes, feature-branch comparison with main and missing history explicitly. Do not assume `HEAD~1` exists in this empty repository. On feature branches validate the full main-to-head introduced range, not merely the latest push, so a later push cannot hide an earlier invalid commit.

Pin GitHub Actions to reviewed immutable SHAs. Use minimum workflow permissions, avoid secret-bearing pull_request_target execution, persist no checkout credentials unless a specific operation requires them and retain useful failure artifacts without environment secrets.

Foundation commits can be pushed directly to main as explicitly requested. After bootstrap, protect main with an open PR requirement, zero mandatory external approvals for the solo owner, unique required GitHub Actions check names, up-to-date branches and blocked force pushes/deletion. Apply the protections to the owner as well, with no routine bypass. Leave merge queue, stale-approval dismissal and most-recent-push approval requirements off. Activate protection only after required checks exist and the foundation is uploaded. Signing policies and mandatory external reviewers are outside the requested baseline.

The future integration procedure is explicit:

1. Prepare changes locally on a feature/release branch with both required identities. Update that branch locally onto current remote main and push it; open its PR.
2. Wait for actual branch-push CI success on the exact final head SHA, including all introduced commits' messages and identities. If a local merge commit is needed, create it on the source branch under Angel's identity and rerun CI on that exact commit before integration.
3. Fetch again and verify neither the remote main base nor PR head changed. Locally fast-forward main to the exact checked head (`git merge --ff-only <checked-head-sha>`) and push normally. Fast-forwarding creates no new commit and preserves both identities. If the base advanced or the normal push is rejected, stop, update the source branch and rerun CI; do not force push or weaken protection.
4. GitHub recognizes a PR whose head becomes reachable from main as indirectly merged. Do not use the web merge buttons, gh pr merge, auto-merge or a merge queue.

GitHub's documentation supports locally integrating up-to-date passing PRs and indirect merges. The combined zero-approval/open-PR/exact-head-fast-forward path has not been exercised against this repository. Include a genuine, non-deploying acceptance check when protections are enabled; use a useful maintenance change rather than a no-op fixture commit. If the foundation's main-only scope precludes that acceptance PR now, report it as pending the first real future PR, rather than claiming observed remote enforcement. Do not preemptively introduce an admin bypass.

## Releases and deployment

Production has exactly one automatic path: a human-created valid release tag triggers deployment validation. Do not deploy from ordinary main pushes, PRs or GitHub Release events as additional production triggers.

1. Owner prepares the next version/changelog and any lockfile metadata on a release branch using both required Git identities, reviews the generated changes and commits them. Integrate its PR through the local exact-head fast-forward procedure above after CI. From clean synchronized main, the owner then runs release-it in tag-only finalization mode for the already-merged package version: no increment, file mutation or new commit, only the annotated immutable `vX.Y.Z` tag and its explicit push. The annotated tagger identity also uses Angel's required name/email. Keep preparation hooks disabled during finalization and assert the tree stays clean. Disable npm publishing and automated bot commits. Proposed first published version is 0.1.0; setup itself creates neither that tag nor a release. The builder may use two small release-it profiles if that makes the phase boundaries clearer; verify the current supported flags before implementation.
2. Tag CI resolves the exact tag commit, checks valid SemVer and version agreement, verifies membership of remote main, validates all release checks and builds that commit. Do not check out moving main for the release build.
3. Disable Vercel Git-created deployments in repository configuration before connecting the project. Resolve the intended account/team and project; link without deploying. Preview deployment policy for future branches can be added later; it is not a second production path.
4. The deploy workflow uses the pinned Vercel CLI: pull production configuration, build production output, stage the prebuilt production deployment without domain assignment, smoke-test that exact deployment and promote its exact URL only after success. Verify the production build, rather than treating a separate Astro build as proof of the deployed bytes.
5. Scope credentials to the needed steps. Never commit `.vercel/`, fetched environment files or tokens. CI variables may hold non-secret project/team IDs; the owner supplies secrets through the platform's secret UI, never in chat or committed files.
6. Serialize production deployments and reject stale/out-of-order promotions. Concurrency alone is insufficient proof of version order. Failed deployments do not mutate/reuse tags or overwrite a previously successful release. Reruns use the same tag SHA and an explicit idempotent release record.
7. A GitHub Release may be created from the validated tag by the same workflow after successful promotion. This is a platform release record, not a Git commit. Avoid chaining a second workflow from events created by GITHUB_TOKEN.
8. Document rollback to a known successful deployment and record the difference between the latest Git version and the currently deployed version.

Linking is in scope; publication is not. If credentials or a target project are unavailable during implementation, finish local and CI work, document the exact pending connection steps and ask for the missing account/project selection. Do not claim a configured repository is already connected or deployed.

## Repository hygiene and documentation

Track source, configs, lockfile, meaningful tests, architecture decisions, the approved plan, maintenance/release instructions and the changelog when present.

Ignore node_modules, dist, .astro, .vercel, coverage, test results, Playwright reports/traces, local environment files, OS/editor caches, logs, temporary research and docs/files. Keep sanitized example environment files only if there are actual documented variables. Do not ignore entire source/component/config directories or all documentation. Do not force README.md edits through scaffolding, check/fix commands or documentation tooling.

## Completion criteria for the future implementation

- A fresh checkout with the documented supported runtime installs reproducibly and activates local hooks through the intended setup path.
- The complete health command passes and a deliberately invalid conventional commit message fails validation; staged-file hooks preserve unstaged changes.
- Shared tokens drive the minimal static page and used Starwind components in light/dark/system modes; meaningful render/browser tests pass.
- GitHub CI validates the actual pushed foundation and reports required checks. Local success is not reported as remote CI success.
- Vercel is linked to the intended project with Git auto-deployments disabled and future tag deployment settings documented/configured. No first deployment, production promotion, release or release tag has been created.
- Foundation commits use the required author AND committer identity and main. All introduced-history identity checks include persistent merge commits. The documented future local integration procedure preserves the exact tested SHA; any unexercised remote acceptance condition is reported. README.md is unchanged or remains absent.
- All limitations and any missing external setup are reported accurately; no hypothetical configuration is described as verified live behavior.

## Builder choices and external prerequisites

The builder may choose exact compatible versions, a minimal neutral token palette, final utility/test helper names, small browser test counts and actionlint installation mechanics. These are engineering defaults, not user-provided requirements.

Before making the actual Vercel connection, inspect available authenticated tooling and resolve the correct Vercel account/team/project and any canonical URL already available. A custom domain and production SEO metadata are not prerequisites for local setup; the Vercel project URL can be recorded when known. Do not invent a public URL or change global machine settings.

## Primary references used in research

- https://docs.astro.build/en/concepts/islands/
- https://docs.astro.build/en/reference/container-reference/
- https://docs.astro.build/en/guides/testing/
- https://docs.astro.build/en/guides/typescript/
- https://starwind.dev/docs/frameworks/astro/
- https://starwind.dev/docs/getting-started/migration/
- https://starwind.dev/docs/getting-started/theming/
- https://starwind.dev/docs/getting-started/dark-mode/
- https://biomejs.dev/introduction/language-support/
- https://github.com/withastro/prettier-plugin-astro
- https://ota-meshi.github.io/eslint-plugin-astro/user-guide/
- https://lefthook.dev/configuration/run/
- https://commitlint.js.org/guides/ci-setup.html
- https://pnpm.io/settings
- https://github.com/release-it/release-it
- https://vercel.com/docs/project-configuration/git-configuration
- https://vercel.com/docs/deployments/promoting-a-deployment
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow
- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
- https://docs.github.com/en/pull-requests/reference/pull-request-merges#indirect-merges
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-a-pull-request-before-merging

These references support planning. Implementation must verify current package APIs and installed behavior before claiming compatibility or completion.
