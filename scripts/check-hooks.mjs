import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const root = process.env.PORTFOLIO_ROOT
  ? path.resolve(process.env.PORTFOLIO_ROOT)
  : scriptRoot;
const hooks = ['pre-commit', 'commit-msg', 'pre-push'];
const failures = [];

for (const name of hooks) {
  const gitPath = execFileSync(
    'git',
    ['rev-parse', '--git-path', `hooks/${name}`],
    {
      cwd: root,
      encoding: 'utf8',
    },
  ).trim();
  const hookPath = path.resolve(root, gitPath);

  if (!fs.existsSync(hookPath)) {
    failures.push(`${name}: missing ${hookPath}`);
    continue;
  }

  const contents = fs.readFileSync(hookPath, 'utf8');
  const wiring = `call_lefthook run "${name}"`;

  if (!contents.includes(wiring)) {
    failures.push(`${name}: ${hookPath} is not wired to Lefthook`);
    continue;
  }

  if (
    name === 'pre-commit' &&
    !contents.includes(`${wiring} --no-stage-fixed`)
  ) {
    failures.push(
      `${name}: ${hookPath} must disable Lefthook's stash/restore guard`,
    );
    continue;
  }

  console.log(`${name}: ${hookPath}`);
}

if (failures.length > 0) {
  console.error(`Hook check failed:\n${failures.join('\n')}`);
  process.exitCode = 1;
}
