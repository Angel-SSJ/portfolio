import semver from 'semver';
import {
  createReleaseServices,
  OWNER,
  STABLE_TAG_RE,
  validateTag,
} from './lib/releases.mjs';

/** @typedef {{ name: string, email: string }} Owner */
/** @typedef {{ name: string, exists: boolean, annotated: boolean, taggerName: string, taggerEmail: string, sha: string }} TagFacts */
/** @typedef {{ branch: string | null, upstreamSha: string | null, headSha: string, packageVersion: string, clean: boolean, user: Owner, tag: TagFacts | null }} LocalFacts */
/** @typedef {{ mainSha: string, onMain: boolean }} RemoteFacts */
/** @typedef {{ status: string, sha: string | null }} CiFacts */
/** @typedef {{ local: (tagName?: string | null) => Promise<LocalFacts>, remote: (sha?: string | null) => Promise<RemoteFacts>, ci: (input: { sha: string }) => Promise<CiFacts> }} Services */

/**
 * @param {LocalFacts} local
 * @param {RemoteFacts | null} remote
 * @param {CiFacts | null} ci
 * @returns {string[]}
 */
function verifyLocal(local, remote, ci) {
  const errors = [];

  if (local.branch !== 'main') {
    errors.push('branch-not-main');
  }

  if (!local.upstreamSha) {
    errors.push('missing-upstream');
  }

  if (
    !remote ||
    local.headSha !== remote.mainSha ||
    local.upstreamSha !== remote.mainSha
  ) {
    errors.push('main-not-synchronized');
  }

  if (!local.clean) {
    errors.push('working-tree-not-clean');
  }

  if (local.user.name !== OWNER.name || local.user.email !== OWNER.email) {
    errors.push('identity-mismatch');
  }

  if (
    !semver.valid(local.packageVersion) ||
    semver.prerelease(local.packageVersion) !== null ||
    local.packageVersion === '0.0.0'
  ) {
    errors.push('invalid-version');
  }

  if (local.tag?.exists) {
    errors.push('tag-already-exists');
  }

  if (ci?.status !== 'success') {
    errors.push('ci-unverified');
  } else if (ci.sha !== local.headSha) {
    errors.push('ci-wrong-sha');
  }

  return errors;
}

/**
 * @param {string | null} tagName
 * @param {LocalFacts} local
 * @param {RemoteFacts | null} remote
 * @param {CiFacts | null} ci
 * @returns {string[]}
 */
function verifyTag(tagName, local, remote, ci) {
  const errors = [];

  if (!tagName || !STABLE_TAG_RE.test(tagName)) {
    errors.push('invalid-tag');
    return errors;
  }

  if (!local.clean) {
    errors.push('working-tree-not-clean');
  }

  if (local.user.name !== OWNER.name || local.user.email !== OWNER.email) {
    errors.push('identity-mismatch');
  }

  const tag = local.tag;

  if (!tag?.exists || !tag.sha) {
    errors.push('tag-missing');
    return errors;
  }

  if (tag.name !== tagName) {
    errors.push('tag-mismatch');
  }

  if (local.headSha !== tag.sha) {
    errors.push('head-mismatch');
  }

  errors.push(
    ...validateTag({
      tagName,
      packageVersion: local.packageVersion,
      commitSha: tag.sha,
      onMain: remote?.onMain === true,
      annotated: tag.annotated,
      taggerName: tag.taggerName,
      taggerEmail: tag.taggerEmail,
    }),
  );

  if (!remote) {
    errors.push('remote-unreachable');
  } else if (remote.mainSha !== tag.sha) {
    errors.push('main-not-synchronized');
  }

  if (ci?.status !== 'success') {
    errors.push('ci-unverified');
  } else if (ci.sha !== tag.sha) {
    errors.push('ci-wrong-sha');
  }

  return errors;
}

/**
 * @param {{ cwd?: string, mode?: 'local' | 'tag', tagName?: string | null, services?: Services }} [input]
 * @returns {Promise<{ errors: string[] }>}
 */
export async function verifyRelease(input = {}) {
  const cwd = input.cwd ?? process.cwd();
  const mode = input.mode ?? 'local';
  const tagName = input.tagName ?? null;
  const services = input.services ?? createReleaseServices(cwd);

  if (mode !== 'local' && mode !== 'tag') {
    return { errors: ['invalid-mode'] };
  }

  let local = null;

  try {
    local = await services.local(tagName);
  } catch {
    return { errors: ['local-facts-unavailable'] };
  }

  let remote = null;

  try {
    remote = await services.remote(
      mode === 'tag' ? (local.tag?.sha ?? null) : local.headSha,
    );
  } catch {
    return { errors: ['remote-unreachable'] };
  }

  let ci = null;

  try {
    ci = await services.ci({
      sha: mode === 'tag' ? (local.tag?.sha ?? local.headSha) : local.headSha,
    });
  } catch {
    ci = null;
  }

  return {
    errors:
      mode === 'local'
        ? verifyLocal(local, remote, ci)
        : verifyTag(tagName, local, remote, ci),
  };
}

async function main() {
  const args = process.argv.slice(2);
  /** @type {'local' | 'tag'} */
  let mode = 'local';
  /** @type {string | null} */
  let tagName = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--tag') {
      tagName = args[index + 1] ?? null;
      index += 1;
    } else if (arg === '--local') {
      mode = 'local';
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exitCode = 2;
      return;
    }
  }

  if (tagName) {
    mode = 'tag';
  }

  const { errors } = await verifyRelease({ mode, tagName });

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`error: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Release checks passed (${mode}).`);
}

if (process.argv[1]?.endsWith('verify-release.mjs')) {
  await main();
}
