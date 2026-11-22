import { describe, expect, it } from 'vitest';
import { parseStagedDeployment } from '../../scripts/verify-staged-deployment.mjs';

const projectId = 'prj_test';
const host = 'staged-deployment.vercel.app';

describe('parseStagedDeployment', () => {
  it('accepts a ready production deployment from the selected project', () => {
    expect(
      parseStagedDeployment(
        {
          id: 'dpl_test',
          url: host,
          projectId,
          target: 'production',
          readyState: 'READY',
          readySubstate: 'STAGED',
        },
        projectId,
        host,
      ),
    ).toEqual({ id: 'dpl_test', url: host });
  });

  it('rejects unexpected project, host, target or state', () => {
    const valid = {
      id: 'dpl_test',
      url: host,
      projectId,
      target: 'production',
      readyState: 'READY',
    };

    expect(() =>
      parseStagedDeployment(
        { ...valid, projectId: 'prj_other' },
        projectId,
        host,
      ),
    ).toThrow();
    expect(() =>
      parseStagedDeployment(
        { ...valid, url: 'other.vercel.app' },
        projectId,
        host,
      ),
    ).toThrow();
    expect(() =>
      parseStagedDeployment({ ...valid, target: 'staging' }, projectId, host),
    ).toThrow();
    expect(() =>
      parseStagedDeployment(
        { ...valid, readyState: 'BUILDING' },
        projectId,
        host,
      ),
    ).toThrow();
  });
});
