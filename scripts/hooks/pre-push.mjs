import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityErrors, messageErrors, readCommits } from '../lib/commits.mjs';

const scriptRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const root = process.env.PORTFOLIO_ROOT
  ? path.resolve(process.env.PORTFOLIO_ROOT)
  : scriptRoot;
const configPath = path.join(root, 'commitlint.config.mjs');

async function readStdin() {
  if (process.stdin.isTTY) {
    return '';
  }

  let input = '';

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  return input;
}

async function main() {
  const input = await readStdin();
  const ranges = new Map();

  for (const line of input.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);

    if (fields.length < 4) {
      continue;
    }

    const [localRef, localSha, , remoteSha] = fields;

    if (!localRef?.startsWith('refs/heads/') || !localSha || !remoteSha) {
      continue;
    }
    if (/^0+$/.test(localSha)) {
      continue;
    }

    const base = /^0+$/.test(remoteSha) ? null : remoteSha;
    const key = `${base ?? 'ROOT'}..${localSha}`;

    if (!ranges.has(key)) {
      ranges.set(key, { head: localSha, base });
    }
  }

  const problems = [];

  for (const { head, base } of ranges.values()) {
    const commits = await readCommits({ cwd: process.cwd(), head, base });

    for (const commit of commits) {
      const found = [
        ...identityErrors(commit).map((field) => `identity:${field}`),
        ...messageErrors(commit, { configPath, cwd: process.cwd() }),
      ];

      if (found.length > 0) {
        problems.push(
          `${commit.sha} ${commit.message}\n  ${found.join('\n  ')}`,
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error(`Pre-push commit policy failed:\n${problems.join('\n')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`Pre-push commit policy could not be evaluated: ${detail}`);
  process.exitCode = 1;
});
