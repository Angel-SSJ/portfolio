import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  createReleaseServices,
  git,
  readPackageVersion,
} from './lib/releases.mjs';
import { verifyRelease } from './verify-release.mjs';

const ROOT = process.env.PORTFOLIO_ROOT ?? process.cwd();

/**
 * @param {{ cwd?: string, tagName?: string | null, services?: ReturnType<typeof createReleaseServices>, dryRun?: boolean }} [input]
 * @returns {Promise<{ errors: string[] }>}
 */
export async function finalizeRelease(input = {}) {
  const cwd = input.cwd ?? process.cwd();
  const services = input.services ?? createReleaseServices(cwd);
  const tagName = input.tagName ?? `v${readPackageVersion(cwd)}`;
  const dryRun = input.dryRun ?? false;
  const remoteTag = git(
    cwd,
    ['ls-remote', '--exit-code', 'origin', `refs/tags/${tagName}`],
    { allowFailure: true },
  );

  if (remoteTag) {
    return verifyRelease({ cwd, mode: 'tag', tagName, services });
  }

  const verified = await verifyRelease({ cwd, mode: 'local', services });

  if (verified.errors.length > 0) {
    return verified;
  }

  const version = readPackageVersion(cwd);
  const args = [
    '--config',
    path.join(cwd, '.release-it.json'),
    '--ci',
    '--quiet',
    '--no-increment',
    `--git.tagName=${tagName}`,
    `--git.tagAnnotation=Release ${version}`,
  ];

  if (dryRun) {
    args.push('--dry-run');
  }

  execFileSync(
    process.execPath,
    [
      path.join(ROOT, 'node_modules', 'release-it', 'bin', 'release-it.js'),
      ...args,
    ],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, PORTFOLIO_ROOT: ROOT },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (dryRun) {
    return { errors: [] };
  }

  const tagVerified = await verifyRelease({
    cwd,
    mode: 'tag',
    tagName,
    services,
  });

  if (tagVerified.errors.length > 0) {
    return tagVerified;
  }

  if ((git(cwd, ['status', '--porcelain']) ?? '') !== '') {
    return { errors: ['working-tree-not-clean'] };
  }

  if (
    !git(cwd, ['rev-parse', '--quiet', '--verify', `refs/tags/${tagName}`], {
      allowFailure: true,
    })
  ) {
    return { errors: ['tag-missing'] };
  }

  execFileSync('git', ['push', '--quiet', 'origin', `refs/tags/${tagName}`], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return { errors: [] };
}

async function main() {
  const args = process.argv.slice(2);
  let tagName = null;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--tag') {
      tagName = args[index + 1] ?? null;
      index += 1;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exitCode = 2;
      return;
    }
  }

  try {
    const { errors } = await finalizeRelease({ tagName, dryRun });

    if (errors.length > 0) {
      for (const error of errors) {
        console.error(`error: ${error}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log(
      dryRun
        ? 'Finalization dry run passed.'
        : `Pushed ${tagName ?? 'release tag'}.`,
    );
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('finalize-release.mjs')) {
  await main();
}
