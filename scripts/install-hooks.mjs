import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
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
const require = createRequire(path.join(root, 'package.json'));
const lefthook = path.join(
  path.dirname(require.resolve('lefthook/package.json')),
  'bin/index.js',
);
const hookNames = ['pre-commit', 'commit-msg', 'pre-push'];
const target = `call_lefthook run "pre-commit" "$@"`;
const replacement = `call_lefthook run "pre-commit" --no-stage-fixed "$@"`;

/**
 * @param {string} name
 * @returns {string}
 */
function hookPath(name) {
  const gitPath = execFileSync(
    'git',
    ['rev-parse', '--git-path', `hooks/${name}`],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  ).trim();

  return path.resolve(process.cwd(), gitPath);
}

execFileSync(process.execPath, [lefthook, 'install', '--force'], {
  cwd: process.cwd(),
  stdio: 'inherit',
});

for (const name of hookNames) {
  const file = hookPath(name);
  const contents = fs.readFileSync(file, 'utf8');

  if (name === 'pre-commit') {
    if (!contents.includes(target)) {
      throw new Error(`Unexpected pre-commit hook wiring in ${file}`);
    }

    fs.writeFileSync(file, contents.replace(target, replacement), 'utf8');
  }

  fs.chmodSync(file, 0o755);
  console.log(`installed ${name}: ${file}`);
}
