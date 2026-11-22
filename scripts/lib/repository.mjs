import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {object} PackageShape
 * @property {boolean} [private]
 * @property {string} [packageManager]
 * @property {{ node?: string }} [engines]
 * @property {Record<string, string>} [scripts]
 * @property {Record<string, string>} [dependencies]
 * @property {Record<string, string>} [devDependencies]
 * @property {{ deploymentEnabled?: unknown }} [git]
 * @property {unknown} [framework]
 * @property {unknown} [installCommand]
 * @property {unknown} [buildCommand]
 * @property {unknown} [outputDirectory]
 * @property {Record<string, unknown>[]} [rewrites]
 */

const FORBIDDEN_TRACKED = [
  /^node_modules\//,
  /^dist\//,
  /^\.astro\//,
  /^\.tools\//,
  /^\.vercel\//,
  /^test-results\//,
  /^playwright-report\//,
  /^coverage\//,
  /\.log$/,
];

const EXACT_DEPENDENCIES = [
  'astro',
  'typescript',
  'vitest',
  '@playwright/test',
  '@axe-core/playwright',
  'lefthook',
  '@commitlint/cli',
  'release-it',
  '@release-it/conventional-changelog',
  'actionlint',
  'vercel',
];

/**
 * @param {string} cwd
 * @param {string} file
 * @returns {string | null}
 */
function readFile(cwd, file) {
  try {
    return fs.readFileSync(path.resolve(cwd, file), 'utf8');
  } catch {
    return null;
  }
}

/**
 * @param {string} cwd
 * @param {string} file
 * @returns {PackageShape | null}
 */
function readJson(cwd, file) {
  try {
    return JSON.parse(readFile(cwd, file) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * @param {string} cwd
 * @returns {string[]}
 */
function trackedFiles(cwd) {
  return execFileSync('git', ['ls-files', '-z'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\0')
    .filter(Boolean);
}

/**
 * @param {string} file
 * @returns {boolean}
 */
function isForbiddenTrackedFile(file) {
  return (
    file === '.env' ||
    (file.startsWith('.env.') && file !== '.env.example') ||
    FORBIDDEN_TRACKED.some((pattern) => pattern.test(file))
  );
}

/**
 * @param {PackageShape} pkg
 * @param {string[]} errors
 */
function hasScriptOwnership(pkg, errors) {
  const scripts = pkg.scripts ?? {};
  const expected = {
    'format:check': ['biome', 'prettier'],
    lint: ['biome', 'eslint'],
    typecheck: ['astro', 'check'],
    'test:unit': ['vitest', 'run'],
    'test:integration': ['vitest', 'run'],
    'test:e2e': ['playwright', 'test'],
    'check:repo': ['node'],
    doctor: ['node'],
    health: ['node'],
    verify: ['node'],
    'release:check': ['node'],
    'check:workflows': ['node'],
  };

  for (const [name, needles] of Object.entries(expected)) {
    const command = scripts[name];

    if (
      typeof command !== 'string' ||
      needles.some((needle) => !command.includes(needle))
    ) {
      errors.push(`script-ownership:${name}`);
    }
  }

  if (
    String(scripts['test:unit'] ?? '').includes('playwright') ||
    String(scripts['test:integration'] ?? '').includes('playwright')
  ) {
    errors.push('vitest-browser-boundary');
  }
}

/**
 * @param {PackageShape} pkg
 * @param {string | null} nodeVersion
 * @param {string[]} errors
 */
function hasPinnedToolchain(pkg, nodeVersion, errors) {
  if (pkg.private !== true) {
    errors.push('private-package-required');
  }

  if (
    typeof pkg.packageManager !== 'string' ||
    !/^pnpm@\d+\.\d+\.\d+$/.test(pkg.packageManager)
  ) {
    errors.push('pnpm-pin-required');
  }

  const pinnedNode = nodeVersion?.trim() ?? '';
  const nodeEngine = pkg.engines?.node;

  if (
    !/^\d+\.\d+\.\d+$/.test(pinnedNode) ||
    typeof nodeEngine !== 'string' ||
    !nodeEngine.startsWith(pinnedNode.split('.')[0] ?? '')
  ) {
    errors.push('runtime-pin-mismatch');
  }

  for (const name of EXACT_DEPENDENCIES) {
    const version = pkg.devDependencies?.[name] ?? pkg.dependencies?.[name];

    if (typeof version !== 'string' || /[~^><*]/.test(version)) {
      errors.push('dependency-pins-required');
    }
  }
}

/**
 * @param {string} cwd
 * @param {string[]} errors
 */
function inspectTestBoundaries(cwd, errors) {
  for (const file of ['vitest.config.ts', 'vitest.integration.config.ts']) {
    const contents = readFile(cwd, file);

    if (!contents) {
      errors.push(`test-config-missing:${file}`);
    } else if (contents.includes('tests/e2e')) {
      errors.push('vitest-browser-boundary');
    }
  }

  const playwrightConfig = readFile(cwd, 'playwright.config.ts');

  if (
    !playwrightConfig?.includes("testDir: './tests/e2e'") ||
    !playwrightConfig.includes('firefox') ||
    !playwrightConfig.includes('webkit')
  ) {
    errors.push('browser-boundary-config');
  }
}

/**
 * @param {string} cwd
 * @param {string[]} files
 * @param {string[]} errors
 */
function inspectProductionPaths(cwd, files, errors) {
  if (files.some(isForbiddenTrackedFile)) {
    errors.push('forbidden-tracked-artifact');
  }

  const productionFiles = files.filter((file) => file.startsWith('src/'));

  if (
    productionFiles.some((file) => {
      const relative = file.slice('src/'.length);
      const topLevel = relative.split('/')[0] ?? '';
      return ![
        'components',
        'config',
        'layouts',
        'lib',
        'pages',
        'styles',
      ].includes(topLevel);
    })
  ) {
    errors.push('unexpected-production-path');
  }

  if (
    files.some(
      (file) =>
        file.startsWith('src/pages/') &&
        (file.includes('/api/') || /\.(?:js|mjs|ts|tsx)$/.test(file)),
    )
  ) {
    errors.push('static-production-only');
  }

  const astroConfig = readFile(cwd, 'astro.config.mjs');

  if (!astroConfig?.includes("output: 'static'")) {
    errors.push('static-output-required');
  }
}

/**
 * @param {string} cwd
 * @param {string[]} errors
 */
function inspectDeploymentConfiguration(cwd, errors) {
  const vercelConfig = readJson(cwd, 'vercel.json');

  if (!vercelConfig) {
    errors.push('vercel-config-missing');
  } else {
    if (vercelConfig.git?.deploymentEnabled !== false) {
      errors.push('vercel-git-deploy-enabled');
    }

    if (
      vercelConfig.framework !== 'astro' ||
      vercelConfig.installCommand !== 'pnpm install --frozen-lockfile' ||
      vercelConfig.buildCommand !== 'pnpm build' ||
      vercelConfig.outputDirectory !== 'dist'
    ) {
      errors.push('vercel-build-settings-invalid');
    }

    if (
      Array.isArray(vercelConfig.rewrites) &&
      vercelConfig.rewrites.some(
        (rewrite) =>
          rewrite?.source === '/(.*)' ||
          rewrite?.source === '/**' ||
          rewrite?.destination === '/index.html',
      )
    ) {
      errors.push('spa-rewrite-forbidden');
    }
  }

  /** @type {string[]} */
  let workflowFiles = [];

  try {
    workflowFiles = fs
      .readdirSync(path.join(cwd, '.github/workflows'))
      .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'));
  } catch {
    errors.push('workflow-config-missing');
  }

  if (!workflowFiles.includes('deploy.yml') && workflowFiles.length > 0) {
    errors.push('release-workflow-missing');
  }

  let releaseTriggers = 0;

  for (const file of workflowFiles) {
    const contents = readFile(cwd, path.join('.github/workflows', file));

    if (!contents) {
      errors.push('workflow-config-invalid');
      continue;
    }

    const branchLines = contents.match(/branches\s*:\s*\[[^\]]*\]/g) ?? [];
    const tagLines = contents.match(/tags\s*:\s*\[[^\]]*\]/g) ?? [];
    const hasMainPush =
      branchLines.some((line) => /\bmain\b/.test(line)) ||
      /^\s*-\s*['"]?main['"]?\s*$/m.test(contents);
    const hasTagTrigger =
      tagLines.some((line) => line.includes('v*')) ||
      /^\s*-\s*['"]?v\*['"]?\s*$/m.test(contents);
    const hasReleaseEvent = /^\s*release\s*:/m.test(contents);
    const usesVercel =
      contents.includes('VERCEL_TOKEN') ||
      /vercel\s+(?:deploy|promote|build|pull)/.test(contents);

    if (hasMainPush && usesVercel) {
      errors.push('main-deployment-trigger');
    }

    if (hasTagTrigger || hasReleaseEvent) {
      releaseTriggers += 1;

      if (file !== 'deploy.yml') {
        errors.push('duplicate-release-trigger');
      }
    }
  }

  if (releaseTriggers > 1) {
    errors.push('duplicate-release-trigger');
  }

  const deployWorkflow = readFile(
    cwd,
    path.join('.github/workflows', 'deploy.yml'),
  );

  if (
    deployWorkflow &&
    !/tags\s*:\s*\[[^\]]*\bv\*/.test(deployWorkflow) &&
    !/^\s*-\s*['"]?v\*['"]?\s*$/m.test(deployWorkflow)
  ) {
    errors.push('release-trigger-missing');
  }
}

/**
 * @param {{ cwd?: string }} [input]
 * @returns {Promise<{ errors: string[], warnings: string[] }>}
 */
export async function inspectRepository({ cwd = process.cwd() } = {}) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  const pkg = readJson(cwd, 'package.json');
  const nodeVersion = readFile(cwd, '.node-version');

  if (!pkg) {
    errors.push('package-json-missing');
  } else {
    hasScriptOwnership(pkg, errors);
    hasPinnedToolchain(pkg, nodeVersion, errors);
  }

  inspectTestBoundaries(cwd, errors);

  /** @type {string[]} */
  let files = [];

  try {
    files = trackedFiles(cwd);
  } catch {
    errors.push('git-inspection-failed');
  }

  inspectProductionPaths(cwd, files, errors);
  inspectDeploymentConfiguration(cwd, errors);

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}
