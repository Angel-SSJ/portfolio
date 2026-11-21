import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { OWNER } from './releases.mjs';

/**
 * @typedef {object} DoctorFacts
 * @property {boolean} runtimeMatches
 * @property {boolean} pnpmMatches
 * @property {boolean} identityMatches
 * @property {boolean} hooksInstalled
 * @property {boolean} vercelLinked
 * @property {boolean} ciConfigured
 * @property {boolean} secretsConfigured
 * @property {boolean} [externalRequested]
 */

/** @type {Array<[keyof DoctorFacts, string]>} */
const LOCAL_RULES = [
  ['runtimeMatches', 'runtime-mismatch'],
  ['pnpmMatches', 'pnpm-mismatch'],
  ['identityMatches', 'identity-mismatch'],
  ['hooksInstalled', 'hooks-not-installed'],
];

/** @type {Array<[keyof DoctorFacts, string]>} */
const EXTERNAL_RULES = [
  ['vercelLinked', 'vercel-not-linked'],
  ['ciConfigured', 'ci-not-configured'],
  ['secretsConfigured', 'secrets-not-configured'],
];

/**
 * @param {DoctorFacts} facts
 * @returns {{ localReady: boolean, externalReady: boolean, errors: string[], warnings: string[] }}
 */
export function evaluateDoctor(facts) {
  const localErrors = LOCAL_RULES.filter(([key]) => facts[key] !== true).map(
    ([, code]) => code,
  );
  const externalIssues = EXTERNAL_RULES.filter(
    ([key]) => facts[key] !== true,
  ).map(([, code]) => code);
  const externalRequested = facts.externalRequested === true;
  const localReady = localErrors.length === 0;

  return {
    localReady,
    externalReady: localReady && externalIssues.length === 0,
    errors: externalRequested
      ? [...localErrors, ...externalIssues]
      : localErrors,
    warnings: externalRequested ? [] : externalIssues,
  };
}

/**
 * @param {string} cwd
 * @param {string} key
 * @returns {string | null}
 */
function gitValue(cwd, key) {
  try {
    return execFileSync('git', ['config', '--get', key], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * @param {string} cwd
 * @param {string} command
 * @param {string[]} args
 * @returns {string | null}
 */
function commandValue(cwd, command, args) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * @param {string} cwd
 * @returns {string | null}
 */
function pnpmVersion(cwd) {
  const localPnpm = path.resolve(
    cwd,
    '.tools/pnpm/node_modules/pnpm/bin/pnpm.mjs',
  );

  if (fs.existsSync(localPnpm)) {
    return commandValue(cwd, process.execPath, [localPnpm, '--version']);
  }

  return commandValue(cwd, 'pnpm', ['--version']);
}

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
 * @returns {boolean}
 */
function hooksInstalled(cwd) {
  for (const name of ['pre-commit', 'commit-msg', 'pre-push']) {
    const gitPath = commandValue(cwd, 'git', [
      'rev-parse',
      '--git-path',
      `hooks/${name}`,
    ]);

    if (!gitPath) {
      return false;
    }

    const contents = readFile(cwd, gitPath);

    if (!contents?.includes(`call_lefthook run "${name}"`)) {
      return false;
    }

    if (
      name === 'pre-commit' &&
      !contents.includes('call_lefthook run "pre-commit" --no-stage-fixed')
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @param {string} cwd
 * @returns {boolean}
 */
function vercelLinked(cwd) {
  try {
    const project = JSON.parse(readFile(cwd, '.vercel/project.json') ?? 'null');
    return (
      typeof project?.orgId === 'string' &&
      project.orgId.length > 0 &&
      typeof project?.projectId === 'string' &&
      project.projectId.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * @param {string} cwd
 * @returns {boolean}
 */
function ciConfigured(cwd) {
  const workflowDir = path.resolve(cwd, '.github/workflows');

  try {
    return fs.readdirSync(workflowDir).some((file) => /\.ya?ml$/.test(file));
  } catch {
    return false;
  }
}

/**
 * @param {{ cwd?: string, externalRequested?: boolean }} [input]
 * @returns {DoctorFacts}
 */
export function collectDoctorFacts({
  cwd = process.cwd(),
  externalRequested = false,
} = {}) {
  const nodeVersion = process.version.replace(/^v/, '');
  const expectedNode = readFile(cwd, '.node-version')?.trim();
  const packageJson = JSON.parse(readFile(cwd, 'package.json') ?? '{}');
  const expectedPnpm = String(packageJson.packageManager ?? '').replace(
    /^pnpm@/,
    '',
  );
  const actualPnpm = pnpmVersion(cwd);

  return {
    runtimeMatches: expectedNode === nodeVersion,
    pnpmMatches:
      expectedPnpm.length > 0 &&
      !/[~^><]/.test(expectedPnpm) &&
      expectedPnpm === actualPnpm,
    identityMatches:
      gitValue(cwd, 'user.name') === OWNER.name &&
      gitValue(cwd, 'user.email') === OWNER.email,
    hooksInstalled: hooksInstalled(cwd),
    vercelLinked: vercelLinked(cwd),
    ciConfigured: ciConfigured(cwd),
    secretsConfigured: false,
    externalRequested,
  };
}
