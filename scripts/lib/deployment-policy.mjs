import semver from 'semver';

const SHA_RE = /^[0-9a-f]{40}$/i;

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
 * @param {{
 *   phase: 'preflight' | 'promotion',
 *   candidateVersion: string | null,
 *   candidateSha: string | null,
 *   expectedSha: string | null,
 *   latestSuccessfulVersion: string | null,
 *   deployedVersion: string | null,
 *   deployedSha: string | null,
 *   requiredChecksSucceeded: boolean,
 *   smokeSucceeded: boolean,
 * }} input
 */
export function promotionDecision(input) {
  if (input.phase !== 'preflight' && input.phase !== 'promotion') {
    return { action: 'reject', reason: 'invalid-phase' };
  }

  const candidateVersion = input.candidateVersion;

  if (
    typeof candidateVersion !== 'string' ||
    !isStableVersion(candidateVersion)
  ) {
    return { action: 'reject', reason: 'invalid-version' };
  }

  if (
    !SHA_RE.test(input.candidateSha ?? '') ||
    !SHA_RE.test(input.expectedSha ?? '') ||
    input.candidateSha !== input.expectedSha
  ) {
    return { action: 'reject', reason: 'sha-mismatch' };
  }

  if (
    (input.latestSuccessfulVersion &&
      !isStableVersion(input.latestSuccessfulVersion)) ||
    (input.deployedVersion && !isStableVersion(input.deployedVersion)) ||
    (input.deployedSha && !SHA_RE.test(input.deployedSha))
  ) {
    return { action: 'reject', reason: 'invalid-records' };
  }

  if (!input.requiredChecksSucceeded) {
    return { action: 'reject', reason: 'required-checks-failed' };
  }

  if (
    input.deployedVersion &&
    semver.eq(candidateVersion, input.deployedVersion)
  ) {
    if (input.deployedSha === input.candidateSha) {
      return { action: 'already-current' };
    }

    return { action: 'reject', reason: 'same-version-different-sha' };
  }

  if (
    Boolean(input.latestSuccessfulVersion) !== Boolean(input.deployedVersion)
  ) {
    return { action: 'reject', reason: 'inconsistent-records' };
  }

  if (input.deployedVersion && !input.deployedSha) {
    return { action: 'reject', reason: 'inconsistent-records' };
  }

  if (
    input.latestSuccessfulVersion &&
    input.deployedVersion &&
    !semver.eq(input.latestSuccessfulVersion, input.deployedVersion)
  ) {
    return { action: 'reject', reason: 'inconsistent-records' };
  }

  if (
    input.latestSuccessfulVersion &&
    semver.lt(candidateVersion, input.latestSuccessfulVersion)
  ) {
    return { action: 'reject', reason: 'stale-version' };
  }

  if (input.phase === 'promotion') {
    if (!input.smokeSucceeded) {
      return { action: 'reject', reason: 'smoke-tests-failed' };
    }

    return { action: 'promote' };
  }

  return { action: 'stage' };
}
