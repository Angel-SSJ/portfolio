import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import semver from 'semver';

/** @typedef {{ name: string, email: string }} Owner */
/** @typedef {{ tagName: string, packageVersion: string, commitSha: string, onMain: boolean, annotated: boolean, taggerName: string, taggerEmail: string }} TagInput */
/** @typedef {{ name: string, exists: boolean, annotated: boolean, taggerName: string, taggerEmail: string, sha: string }} TagFacts */
/** @typedef {{ branch: string | null, upstreamSha: string | null, headSha: string, packageVersion: string, clean: boolean, user: Owner, tag: TagFacts | null }} LocalFacts */
/** @typedef {{ mainSha: string, onMain: boolean }} RemoteFacts */
/** @typedef {{ status: string, sha: string | null }} CiFacts */

export const OWNER = {
  name: 'Angel Ramirez',
  email: 'angelgabriel.16ra@gmail.com',
};

export const STABLE_TAG_RE = /^v\d+\.\d+\.\d+$/;

/**
 * @param {string} cwd
 * @param {string[]} args
 * @param {{ allowFailure?: boolean }} [options]
 * @returns {string | null}
 */
export function git(cwd, args, options = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (options.allowFailure) {
      return null;
    }
    throw error;
  }
}

/**
 * @param {string} cwd
 * @returns {string}
 */
export function readPackageVersion(cwd) {
  const manifest = JSON.parse(
    readFileSync(path.join(cwd, 'package.json'), 'utf8'),
  );

  if (typeof manifest.version !== 'string') {
    throw new Error('package.json has no version');
  }

  return manifest.version;
}

/**
 * @param {TagInput} input
 * @returns {string[]}
 */
export function validateTag(input) {
  const errors = [];

  if (!STABLE_TAG_RE.test(input.tagName)) {
    errors.push('invalid-tag');
  }

  if (
    typeof input.packageVersion !== 'string' ||
    !semver.valid(input.packageVersion) ||
    semver.prerelease(input.packageVersion) !== null
  ) {
    errors.push('invalid-version');
  }

  if (
    STABLE_TAG_RE.test(input.tagName) &&
    input.tagName.slice(1) !== input.packageVersion
  ) {
    errors.push('version-mismatch');
  }

  if (!input.annotated) {
    errors.push('tag-not-annotated');
  }

  if (input.taggerName !== OWNER.name || input.taggerEmail !== OWNER.email) {
    errors.push('tagger-mismatch');
  }

  if (!input.onMain) {
    errors.push('commit-not-on-main');
  }

  if (!/^[0-9a-f]{40}$/.test(input.commitSha)) {
    errors.push('invalid-sha');
  }

  return errors;
}

/**
 * @param {string} cwd
 * @returns {Owner}
 */
function readUser(cwd) {
  return {
    name: git(cwd, ['config', 'user.name'], { allowFailure: true }) ?? '',
    email: git(cwd, ['config', 'user.email'], { allowFailure: true }) ?? '',
  };
}

/**
 * @param {string} cwd
 * @param {string | null} tagName
 * @returns {TagFacts | null}
 */
function readTag(cwd, tagName) {
  if (!tagName) {
    return null;
  }

  const row = git(
    cwd,
    [
      'for-each-ref',
      '--format=%(objecttype)%00%(taggername)%00%(taggeremail)%00%(objectname)%00%(*objectname)',
      `refs/tags/${tagName}`,
    ],
    { allowFailure: true },
  );

  if (!row) {
    return null;
  }

  const [type, taggerName, taggerEmail, objectName, peeledName] =
    row.split('\0');

  return {
    name: tagName,
    exists: true,
    annotated: type === 'tag',
    taggerName: taggerName ?? '',
    taggerEmail: (taggerEmail ?? '').replace(/^<|>$/g, ''),
    sha: type === 'tag' ? (peeledName ?? objectName ?? '') : (objectName ?? ''),
  };
}

/**
 * @param {string} cwd
 * @param {string | null} tagName
 * @returns {LocalFacts}
 */
function readLocal(cwd, tagName) {
  const branch = git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    allowFailure: true,
  });
  const upstreamSha = branch
    ? git(cwd, ['rev-parse', '@{upstream}'], { allowFailure: true })
    : null;

  return {
    branch,
    upstreamSha,
    headSha: git(cwd, ['rev-parse', 'HEAD']) ?? '',
    packageVersion: readPackageVersion(cwd),
    clean: (git(cwd, ['status', '--porcelain']) ?? '') === '',
    user: readUser(cwd),
    tag: readTag(cwd, tagName),
  };
}

/**
 * @param {string} cwd
 * @returns {string}
 */
function readRepoSlug(cwd) {
  const url = git(cwd, ['remote', 'get-url', 'origin']) ?? '';
  const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/);

  if (!match) {
    throw new Error('origin is not a GitHub repository');
  }

  return `${match[1]}/${match[2]}`;
}

/**
 * @param {string} output
 * @param {string} sha
 * @returns {CiFacts}
 */
export function parseQualityConclusions(output, sha) {
  const runs = output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, conclusion] = line.split('\t');

      return { id: Number(id), conclusion: (conclusion ?? '').trim() };
    })
    .filter((run) => Number.isSafeInteger(run.id))
    .sort((left, right) => right.id - left.id);
  const success = runs[0]?.conclusion === 'success';

  return { status: success ? 'success' : 'failure', sha: success ? sha : null };
}

/**
 * @param {string} cwd
 * @param {string} sha
 * @returns {CiFacts}
 */
function readCi(cwd, sha) {
  const output = execFileSync(
    'gh',
    [
      'api',
      `repos/${readRepoSlug(cwd)}/commits/${sha}/check-runs`,
      '--paginate',
      '--jq',
      '.check_runs[] | select(.name == "quality") | [.id, .conclusion] | @tsv',
    ],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return parseQualityConclusions(output, sha);
}

/**
 * @param {string} cwd
 * @returns {{
 *   local: (tagName?: string | null) => Promise<LocalFacts>,
 *   remote: (sha?: string | null) => Promise<RemoteFacts>,
 *   ci: (input: { sha: string }) => Promise<CiFacts>
 * }}
 */
export function createReleaseServices(cwd) {
  return {
    async local(tagName = null) {
      return readLocal(cwd, tagName);
    },
    async remote(sha = null) {
      git(cwd, ['fetch', '--quiet', 'origin', 'main']);
      const mainSha = git(cwd, ['rev-parse', 'refs/remotes/origin/main']) ?? '';
      let onMain = false;

      if (sha) {
        try {
          git(cwd, [
            'merge-base',
            '--is-ancestor',
            sha,
            'refs/remotes/origin/main',
          ]);
          onMain = true;
        } catch {
          onMain = false;
        }
      }

      return { mainSha, onMain };
    },
    async ci(input) {
      return readCi(cwd, input.sha);
    },
  };
}
