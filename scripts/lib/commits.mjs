import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

const OWNER = {
  authorName: 'Angel Ramirez',
  authorEmail: 'angelgabriel.16ra@gmail.com',
  committerName: 'Angel Ramirez',
  committerEmail: 'angelgabriel.16ra@gmail.com',
};

/** @type {Array<'authorName' | 'authorEmail' | 'committerName' | 'committerEmail'>} */
const IDENTITY_FIELDS = [
  'authorName',
  'authorEmail',
  'committerName',
  'committerEmail',
];

/**
 * @typedef {object} CommitRecord
 * @property {string} sha
 * @property {string} message
 * @property {string} authorName
 * @property {string} authorEmail
 * @property {string} committerName
 * @property {string} committerEmail
 */

/**
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string}
 */
function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * @param {string} cwd
 * @param {string} ref
 * @returns {string}
 */
function resolveCommit(cwd, ref) {
  let sha;

  if (/^0+$/.test(ref)) {
    throw new Error(`Invalid commit SHA resolved from "${ref}": ${ref}`);
  }

  try {
    sha = git(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  } catch {
    throw new Error(`Cannot resolve "${ref}" to a commit in ${cwd}`);
  }

  if (!/^[0-9a-f]{40}$/i.test(sha) || /^0+$/.test(sha)) {
    throw new Error(
      `Invalid commit SHA resolved from "${ref}": ${sha || '(empty)'}`,
    );
  }

  return sha;
}

/**
 * @param {{ cwd: string, head: string, base: string | null }} options
 * @returns {Promise<CommitRecord[]>}
 */
export async function readCommits({ cwd, head, base }) {
  if (!cwd || typeof cwd !== 'string') {
    throw new Error('readCommits requires a cwd string');
  }
  if (!head || typeof head !== 'string') {
    throw new Error('readCommits requires a head ref');
  }

  const headSha = resolveCommit(cwd, head);
  const range =
    base === null ? [headSha] : [`${resolveCommit(cwd, base)}..${headSha}`];

  const output = git(cwd, [
    'log',
    '--no-color',
    '--format=%H%x00%s%x00%an%x00%ae%x00%cn%x00%ce%x00%x1e',
    ...range,
  ]);

  return output
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [
        sha,
        message,
        authorName,
        authorEmail,
        committerName,
        committerEmail,
      ] = record.split('\0');

      if (
        !sha ||
        !message ||
        !authorName ||
        !authorEmail ||
        !committerName ||
        !committerEmail
      ) {
        throw new Error(`Malformed git log record in ${cwd}`);
      }

      return {
        sha,
        message,
        authorName,
        authorEmail,
        committerName,
        committerEmail,
      };
    });
}

/**
 * @param {CommitRecord} commit
 * @returns {string[]}
 */
export function identityErrors(commit) {
  return IDENTITY_FIELDS.filter((field) => commit[field] !== OWNER[field]);
}

/**
 * @param {CommitRecord} commit
 * @param {{ configPath: string, cwd: string }} options
 * @returns {string[]}
 */
export function messageErrors(commit, { configPath, cwd }) {
  const cliEntry = path.join(
    path.dirname(require.resolve('@commitlint/cli')),
    'cli.js',
  );

  try {
    execFileSync(process.execPath, [cliEntry, '--config', configPath], {
      cwd,
      input: `${commit.message}\n`,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return [];
  } catch (error) {
    const failure = /** @type {{ stdout?: unknown, stderr?: unknown }} */ (
      error && typeof error === 'object' ? error : {}
    );
    const output = `${failure.stdout ?? ''}${failure.stderr ?? ''}`.trim();
    return output ? [output] : [`commitlint rejected "${commit.message}"`];
  }
}
