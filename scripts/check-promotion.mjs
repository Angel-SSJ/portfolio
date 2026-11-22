import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import semver from 'semver';
import { promotionDecision } from './lib/deployment-policy.mjs';
import { parseQualityConclusions } from './lib/releases.mjs';

const SHA_RE = /^[0-9a-f]{40}$/i;
const VERSION_META = 'portfolioVersion';
const SHA_META = 'portfolioSha';

/**
 * @param {{
 *   phase: 'preflight' | 'promotion',
 *   loadFacts: (phase: 'preflight' | 'promotion') => Promise<Record<string, unknown>>,
 * }} input
 */
export async function checkPromotion({ phase, loadFacts }) {
  /** @type {Record<string, unknown>} */
  let facts;

  try {
    facts = await loadFacts(phase);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`promotion fact inspection failed: ${message}`);
    return { action: 'reject', reason: 'facts-unavailable' };
  }

  const decisionInput = /** @type {Parameters<typeof promotionDecision>[0]} */ (
    /** @type {unknown} */ ({ phase, ...facts })
  );

  return promotionDecision(decisionInput);
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * @param {string | null | undefined} version
 * @returns {boolean}
 */
function isStableVersion(version) {
  return (
    typeof version === 'string' &&
    semver.valid(version) !== null &&
    semver.prerelease(version) === null
  );
}

/**
 * @param {string} cwd
 * @returns {string}
 */
function readCandidateSha(cwd) {
  const sha =
    process.env.CANDIDATE_SHA ??
    process.env.GITHUB_SHA ??
    run('git', ['rev-parse', 'HEAD'], cwd);

  if (!SHA_RE.test(sha)) {
    throw new Error('candidate SHA unavailable');
  }

  return sha;
}

/**
 * @param {string} cwd
 * @returns {string}
 */
function readExpectedSha(cwd) {
  const sha = process.env.EXPECTED_SHA ?? readCandidateSha(cwd);

  if (!SHA_RE.test(sha)) {
    throw new Error('expected SHA unavailable');
  }

  return sha;
}

/**
 * @param {string} cwd
 * @param {string} sha
 * @returns {boolean}
 */
function requiredChecksSucceeded(cwd, sha) {
  const repository = process.env.GITHUB_REPOSITORY;

  if (!repository) {
    throw new Error('GITHUB_REPOSITORY unavailable');
  }

  const output = run(
    'gh',
    [
      'api',
      `repos/${repository}/commits/${sha}/check-runs`,
      '--paginate',
      '--jq',
      '.check_runs[] | select(.name == "quality") | [.id, .conclusion] | @tsv',
    ],
    cwd,
  );

  return parseQualityConclusions(output, sha).status === 'success';
}

/**
 * @param {string} cwd
 * @returns {string | null}
 */
function highestSuccessfulVersion(cwd) {
  const repository = process.env.GITHUB_REPOSITORY;

  if (!repository) {
    throw new Error('GITHUB_REPOSITORY unavailable');
  }

  const versions = run(
    'gh',
    [
      'api',
      `repos/${repository}/releases`,
      '--paginate',
      '--jq',
      '.[] | select(.draft == false) | .tag_name',
    ],
    cwd,
  )
    .split('\n')
    .map((tag) => (tag.startsWith('v') ? tag.slice(1) : tag))
    .filter(isStableVersion);

  return versions.length > 0 ? (semver.rsort(versions)[0] ?? null) : null;
}

/**
 * @param {unknown} payload
 * @param {string | null} [excludedUrl]
 * @returns {{ version: string | null, sha: string | null }}
 */
export function parseProductionDeployments(payload, excludedUrl = null) {
  const data = /** @type {{ deployments?: unknown }} */ (payload);
  const excludedHost = excludedUrl ? new URL(excludedUrl).hostname : null;

  if (!data || !Array.isArray(data.deployments)) {
    throw new Error('production metadata unavailable');
  }

  const rawDeployments = /** @type {any[]} */ (data.deployments);

  if (rawDeployments.length === 0) {
    return { version: null, sha: null };
  }

  const candidates = rawDeployments.filter(
    (deployment) =>
      deployment?.readySubstate !== 'STAGED' &&
      deployment?.url !== excludedHost,
  );

  if (candidates.length === 0) {
    const onlyExactStaged =
      excludedHost !== null &&
      rawDeployments.every(
        (deployment) =>
          deployment?.url === excludedHost &&
          deployment?.readySubstate === 'STAGED',
      );

    if (onlyExactStaged) {
      return { version: null, sha: null };
    }

    throw new Error('production metadata unavailable');
  }

  const deployments = candidates
    .map((deployment) => ({
      version: deployment?.meta?.[VERSION_META] ?? null,
      sha: deployment?.meta?.[SHA_META] ?? null,
      created:
        typeof deployment?.createdAt === 'number' ? deployment.createdAt : 0,
    }))
    .filter(
      (/** @type {{ version: string | null, sha: string | null }} */ item) =>
        isStableVersion(item.version) && SHA_RE.test(item.sha ?? ''),
    );

  if (deployments.length !== candidates.length) {
    throw new Error('production metadata inconsistent');
  }

  deployments.sort(
    (
      /** @type {{ version: string, created: number }} */ left,
      /** @type {{ version: string, created: number }} */ right,
    ) =>
      right.created - left.created ||
      semver.rcompare(left.version, right.version),
  );

  const deployed = deployments[0];

  if (!deployed) {
    throw new Error('production metadata unavailable');
  }

  return { version: deployed.version, sha: deployed.sha };
}

/**
 * @returns {Promise<{ version: string | null, sha: string | null }>}
 */
async function deployedFacts() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    throw new Error('production metadata unavailable');
  }

  const orgId = process.env.VERCEL_ORG_ID;
  const deployments = [];
  let until = null;

  while (true) {
    const url = new URL('https://api.vercel.com/v7/deployments');
    url.searchParams.set('projectId', projectId);
    url.searchParams.set('target', 'production');
    url.searchParams.set('state', 'READY');
    url.searchParams.set('limit', '100');

    if (orgId) {
      url.searchParams.set('teamId', orgId);
    }

    if (until !== null) {
      url.searchParams.set('until', String(until));
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('production metadata inspection failed');
    }

    const payload = await response.json();

    if (!payload || !Array.isArray(payload.deployments)) {
      throw new Error('production metadata unavailable');
    }

    deployments.push(...payload.deployments);
    const next = payload?.pagination?.next;

    if (next === null || next === undefined) {
      break;
    }

    const nextTimestamp = Number(next);

    if (!Number.isFinite(nextTimestamp) || nextTimestamp === until) {
      throw new Error('production metadata pagination failed');
    }

    until = nextTimestamp;
  }

  return parseProductionDeployments(
    { deployments },
    process.env.EXCLUDED_DEPLOYMENT_URL ?? null,
  );
}

/**
 * @returns {Promise<Record<string, unknown>>}
 */
async function collectPromotionFacts() {
  const cwd = process.cwd();
  const pkg = JSON.parse(
    fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  const candidateSha = readCandidateSha(cwd);
  const expectedSha = readExpectedSha(cwd);
  const deployed = await deployedFacts();

  return {
    candidateVersion: pkg.version ?? null,
    candidateSha,
    expectedSha,
    latestSuccessfulVersion: highestSuccessfulVersion(cwd),
    deployedVersion: deployed.version,
    deployedSha: deployed.sha,
    requiredChecksSucceeded: requiredChecksSucceeded(cwd, expectedSha),
    smokeSucceeded: process.env.SMOKE_SUCCEEDED === 'true',
  };
}

/**
 * @param {string} file
 * @returns {() => Promise<Record<string, unknown>>}
 */
function fixtureFacts(file) {
  return async () => {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));

    if (parsed.inspectError) {
      throw new Error('fixture inspection failure');
    }

    return parsed.facts ?? parsed;
  };
}

async function main() {
  /** @type {'preflight' | 'promotion' | null} */
  let phase = null;
  /** @type {string | null} */
  let factsFile = null;
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--phase') {
      const value = args[index + 1];
      phase = value === 'preflight' || value === 'promotion' ? value : null;
      index += 1;
    } else if (arg === '--facts-file') {
      factsFile = args[index + 1] ?? null;
      index += 1;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exitCode = 2;
      return;
    }
  }

  if (phase !== 'preflight' && phase !== 'promotion') {
    console.error('Expected --phase preflight or --phase promotion');
    process.exitCode = 2;
    return;
  }

  if (factsFile && process.env.PORTFOLIO_TEST_FIXTURES !== '1') {
    console.error('Fact fixtures are only available in test mode');
    process.exitCode = 2;
    return;
  }

  const loadFacts = factsFile
    ? fixtureFacts(factsFile)
    : () => collectPromotionFacts();
  const decision = await checkPromotion({ phase, loadFacts });

  console.log(JSON.stringify(decision));

  if (decision.action === 'reject') {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('check-promotion.mjs')) {
  await main();
}
