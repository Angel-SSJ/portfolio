import { execFileSync } from 'node:child_process';
import path from 'node:path';
import semver from 'semver';
import { git, OWNER, readPackageVersion } from './lib/releases.mjs';

const ROOT = process.env.PORTFOLIO_ROOT ?? process.cwd();

/**
 * @param {{ cwd?: string, version?: string | null }} [input]
 * @returns {{ errors: string[] }}
 */
export function prepareRelease(input = {}) {
  const cwd = input.cwd ?? process.cwd();
  const version = input.version ?? null;
  const errors = [];

  if (
    !version ||
    !semver.valid(version) ||
    semver.prerelease(version) !== null ||
    version === '0.0.0'
  ) {
    errors.push('invalid-version');
  }

  if (!version) {
    return { errors };
  }

  const current = readPackageVersion(cwd);

  if (!semver.gt(version, current)) {
    errors.push('version-not-higher');
  }

  const branch = git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    allowFailure: true,
  });

  if (branch !== `codex/release-v${version}`) {
    errors.push('branch-not-release-branch');
  }

  if (
    (git(cwd, ['config', 'user.name'], { allowFailure: true }) ?? '') !==
      OWNER.name ||
    (git(cwd, ['config', 'user.email'], { allowFailure: true }) ?? '') !==
      OWNER.email
  ) {
    errors.push('identity-mismatch');
  }

  if ((git(cwd, ['status', '--porcelain']) ?? '') !== '') {
    errors.push('working-tree-not-clean');
  }

  if (
    git(cwd, ['rev-parse', '--quiet', '--verify', `refs/tags/v${version}`], {
      allowFailure: true,
    })
  ) {
    errors.push('tag-already-exists');
  }

  if (errors.length > 0) {
    return { errors };
  }

  execFileSync(
    process.execPath,
    [
      path.join(ROOT, 'node_modules', 'release-it', 'bin', 'release-it.js'),
      version,
      '--config',
      path.join(cwd, '.release-it.prepare.json'),
      '--ci',
      '--quiet',
    ],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, PORTFOLIO_ROOT: ROOT },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  return { errors: [] };
}

function main() {
  const version = process.argv[2] ?? null;
  const { errors } = prepareRelease({ version });

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`error: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Prepared v${version} for owner review.`);
}

if (process.argv[1]?.endsWith('prepare-release.mjs')) {
  main();
}
