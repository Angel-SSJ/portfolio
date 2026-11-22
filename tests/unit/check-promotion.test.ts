import { describe, expect, it, vi } from 'vitest';
import {
  checkPromotion,
  parseProductionDeployments,
} from '../../scripts/check-promotion.mjs';

const stageFacts = {
  candidateVersion: '1.2.0',
  candidateSha: '1111111111111111111111111111111111111111',
  expectedSha: '1111111111111111111111111111111111111111',
  latestSuccessfulVersion: null,
  deployedVersion: null,
  deployedSha: null,
  requiredChecksSucceeded: true,
  smokeSucceeded: true,
};

describe('parseProductionDeployments', () => {
  const sha = '1111111111111111111111111111111111111111';

  it('treats confirmed empty production as a first publication', () => {
    expect(parseProductionDeployments({ deployments: [] })).toEqual({
      version: null,
      sha: null,
    });
  });

  it('rejects READY production deployments without portfolio metadata', () => {
    expect(() =>
      parseProductionDeployments({ deployments: [{ meta: {} }] }),
    ).toThrow();
    expect(() =>
      parseProductionDeployments({
        deployments: [{ meta: { portfolioVersion: '1.2.0' } }],
      }),
    ).toThrow();
  });

  it('selects the most recently deployed version with matching metadata', () => {
    expect(
      parseProductionDeployments({
        deployments: [
          {
            meta: { portfolioVersion: '1.1.0', portfolioSha: sha },
            createdAt: 2,
          },
          {
            meta: { portfolioVersion: '1.2.0', portfolioSha: sha },
            createdAt: 1,
          },
        ],
      }),
    ).toEqual({ version: '1.1.0', sha });
  });

  it('excludes the staged deployment from authoritative production state', () => {
    expect(
      parseProductionDeployments(
        {
          deployments: [
            {
              url: 'old-deployment.vercel.app',
              meta: { portfolioVersion: '1.1.0', portfolioSha: sha },
              createdAt: 1,
            },
            {
              url: 'staged-deployment.vercel.app',
              readySubstate: 'STAGED',
              meta: { portfolioVersion: '1.2.0', portfolioSha: sha },
              createdAt: 2,
            },
          ],
        },
        'https://staged-deployment.vercel.app',
      ),
    ).toEqual({ version: '1.1.0', sha });
  });

  it('treats only the exact staged deployment as a first publication', () => {
    expect(
      parseProductionDeployments(
        {
          deployments: [
            {
              url: 'staged-deployment.vercel.app',
              readySubstate: 'STAGED',
              meta: { portfolioVersion: '1.2.0', portfolioSha: sha },
              createdAt: 1,
            },
          ],
        },
        'https://staged-deployment.vercel.app',
      ),
    ).toEqual({ version: null, sha: null });
  });

  it('rejects staged deployments other than the exact staged deployment', () => {
    expect(() =>
      parseProductionDeployments(
        {
          deployments: [
            {
              url: 'other-staged.vercel.app',
              readySubstate: 'STAGED',
              meta: { portfolioVersion: '1.2.0', portfolioSha: sha },
              createdAt: 1,
            },
          ],
        },
        'https://staged-deployment.vercel.app',
      ),
    ).toThrow();
  });
});

describe('checkPromotion', () => {
  it('uses injected read-only facts to decide promotion', async () => {
    const loadFacts = vi.fn().mockResolvedValue(stageFacts);

    const decision = await checkPromotion({ phase: 'preflight', loadFacts });

    expect(loadFacts).toHaveBeenCalledWith('preflight');
    expect(decision.action).toBe('stage');
  });

  it('rejects when fact inspection fails instead of assuming first publication', async () => {
    const loadFacts = vi.fn().mockRejectedValue(new Error('api unavailable'));

    const decision = await checkPromotion({ phase: 'promotion', loadFacts });

    expect(decision.action).toBe('reject');
  });
});
