import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityErrors, messageErrors, readCommits } from './lib/commits.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'commitlint.config.mjs');

/**
 * @param {string[]} argv
 * @returns {{ cwd: string, head: string, base: string | null }}
 */
function parseArgs(argv) {
  let base;
  let head = 'HEAD';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--base') {
      base = argv[++index];
    } else if (arg === '--head') {
      const value = argv[++index];

      if (!value) {
        throw new Error('Missing value for --head');
      }

      head = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!base) {
    throw new Error('Missing --base <ref|ROOT>');
  }
  if (!head) {
    throw new Error('Missing value for --head');
  }

  return {
    cwd: root,
    head,
    base: base === 'ROOT' ? null : base,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const commits = await readCommits(options);
  const lines = [];

  for (const commit of commits) {
    const problems = [
      ...identityErrors(commit).map((field) => `identity:${field}`),
      ...messageErrors(commit, { configPath, cwd: root }),
    ];

    if (problems.length > 0) {
      lines.push(`${commit.sha} ${commit.message}\n  ${problems.join('\n  ')}`);
    }
  }

  if (lines.length > 0) {
    console.error(`Commit policy failed:\n${lines.join('\n')}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Commit policy passed for ${commits.length} commit(s).`);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`Commit policy could not be evaluated: ${detail}`);
  process.exitCode = 1;
});
