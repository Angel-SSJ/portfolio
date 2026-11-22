import { describe, expect, it } from 'vitest';
import { promotionDecision } from '../../scripts/lib/deployment-policy.mjs';

type PromotionInput = Parameters<typeof promotionDecision>[0];

const newCandidate: PromotionInput = {
  phase: 'promotion',
  candidateVersion: '1.2.0',
  candidateSha: '1111111111111111111111111111111111111111',
  expectedSha: '1111111111111111111111111111111111111111',
  latestSuccessfulVersion: '1.1.0',
  deployedVersion: '1.1.0',
  deployedSha: '0000000000000000000000000000000000000000',
  requiredChecksSucceeded: true,
  smokeSucceeded: true,
};

describe('promotionDecision', () => {
  it('rejects a version older than the highest successful release', () => {
    const result = promotionDecision({
      ...newCandidate,
      candidateVersion: '1.0.9',
    });

    expect(result.action).toBe('reject');
  });

  it('promotes a newer version after a successful smoke test', () => {
    const result = promotionDecision(newCandidate);

    expect(result.action).toBe('promote');
  });

  it('stages a newer version during preflight', () => {
    const result = promotionDecision({ ...newCandidate, phase: 'preflight' });

    expect(result.action).toBe('stage');
  });

  it('is idempotent when the exact candidate is already deployed', () => {
    const result = promotionDecision({
      ...newCandidate,
      candidateVersion: '1.2.0',
      candidateSha: '2222222222222222222222222222222222222222',
      expectedSha: '2222222222222222222222222222222222222222',
      latestSuccessfulVersion: '1.2.0',
      deployedVersion: '1.2.0',
      deployedSha: '2222222222222222222222222222222222222222',
    });

    expect(result.action).toBe('already-current');
  });

  it('rejects the same version at a different SHA', () => {
    const result = promotionDecision({
      ...newCandidate,
      candidateVersion: '1.2.0',
      candidateSha: '2222222222222222222222222222222222222222',
      expectedSha: '2222222222222222222222222222222222222222',
      latestSuccessfulVersion: '1.2.0',
      deployedVersion: '1.2.0',
      deployedSha: '3333333333333333333333333333333333333333',
    });

    expect(result.action).toBe('reject');
  });

  it('rejects when the expected SHA changed after validation', () => {
    const result = promotionDecision({
      ...newCandidate,
      expectedSha: '3333333333333333333333333333333333333333',
    });

    expect(result.action).toBe('reject');
  });

  it('rejects when required checks failed', () => {
    const result = promotionDecision({
      ...newCandidate,
      requiredChecksSucceeded: false,
    });

    expect(result.action).toBe('reject');
  });

  it('rejects promotion when the staging smoke tests failed', () => {
    const result = promotionDecision({
      ...newCandidate,
      smokeSucceeded: false,
    });

    expect(result.action).toBe('reject');
  });

  it('uses numeric SemVer ordering instead of string ordering', () => {
    const result = promotionDecision({
      ...newCandidate,
      candidateVersion: '1.10.0',
      latestSuccessfulVersion: '1.9.0',
      deployedVersion: '1.9.0',
    });

    expect(result.action).toBe('promote');
  });

  it('stages a confirmed first publication with no prior facts', () => {
    const result = promotionDecision({
      ...newCandidate,
      phase: 'preflight',
      latestSuccessfulVersion: null,
      deployedVersion: null,
      deployedSha: null,
    });

    expect(result.action).toBe('stage');
  });

  it('recognizes an exact deployment whose release record is missing', () => {
    const result = promotionDecision({
      ...newCandidate,
      latestSuccessfulVersion: null,
      deployedVersion: '1.2.0',
      deployedSha: '1111111111111111111111111111111111111111',
    });

    expect(result.action).toBe('already-current');
  });

  it('rejects inconsistent records where deployment exists without a release', () => {
    const result = promotionDecision({
      ...newCandidate,
      latestSuccessfulVersion: null,
      deployedVersion: '1.1.0',
      deployedSha: '0000000000000000000000000000000000000000',
    });

    expect(result.action).toBe('reject');
  });

  it('rejects inconsistent records where a release exists without a deployment', () => {
    const result = promotionDecision({
      ...newCandidate,
      latestSuccessfulVersion: '1.1.0',
      deployedVersion: null,
      deployedSha: null,
    });

    expect(result.action).toBe('reject');
  });

  it('rejects disagreeing release and deployment versions', () => {
    const result = promotionDecision({
      ...newCandidate,
      latestSuccessfulVersion: '1.1.0',
      deployedVersion: '1.0.0',
      deployedSha: '0000000000000000000000000000000000000000',
    });

    expect(result.action).toBe('reject');
  });

  it('rejects an invalid candidate version instead of treating it as new', () => {
    const result = promotionDecision({
      ...newCandidate,
      candidateVersion: 'not-a-version',
    });

    expect(result.action).toBe('reject');
  });

  it('rejects an unknown phase', () => {
    const result = promotionDecision({
      ...newCandidate,
      phase: 'unknown' as unknown as PromotionInput['phase'],
    });

    expect(result.action).toBe('reject');
  });
});
