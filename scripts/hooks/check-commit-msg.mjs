import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const root = process.env.PORTFOLIO_ROOT
  ? path.resolve(process.env.PORTFOLIO_ROOT)
  : scriptRoot;
const require = createRequire(path.join(root, 'package.json'));
const messageFile = process.argv[2];

if (!messageFile) {
  console.error('Missing commit message file');
  process.exit(1);
}

const cli = path.join(
  path.dirname(require.resolve('@commitlint/cli/package.json')),
  'cli.js',
);
const configPath = path.join(root, 'commitlint.config.mjs');
const message = fs.readFileSync(
  path.resolve(process.cwd(), messageFile),
  'utf8',
);

try {
  execFileSync(process.execPath, [cli, '--config', configPath], {
    cwd: root,
    input: message,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  });
} catch {
  process.exitCode = 1;
}
