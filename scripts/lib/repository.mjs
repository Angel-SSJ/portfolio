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
  try {
    return execFileSync('git', ['ls-files', '-z'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\0')
      .filter(Boolean);
  } catch {
    return [];
  }
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
      return !['components', 'config', 'layouts', 'pages', 'styles'].includes(
        topLevel,
      );
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
  inspectProductionPaths(cwd, trackedFiles(cwd), errors);

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}
