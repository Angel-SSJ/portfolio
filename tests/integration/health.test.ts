import { describe, expect, it } from 'vitest';
import {
  HEALTH_STEPS,
  VERIFY_STEPS,
  runSteps,
} from '../../scripts/run-steps.mjs';

describe('health orchestration', () => {
  it('stops and returns nonzero when a required subprocess fails', async () => {
    const attempted: string[] = [];
    const status = await runSteps({
      steps: VERIFY_STEPS,
      runner(step) {
        attempted.push(step.label);
        return step.label === 'lint' ? 2 : 0;
      },
    });

    expect(status).toBe(2);
    expect(attempted).toEqual(['format', 'lint']);
  });

  it('builds once and runs browser tests after verification', () => {
    const labels = HEALTH_STEPS.map((step) => step.label);

    expect(labels).toEqual([
      ...VERIFY_STEPS.map((step) => step.label),
      'build',
      'browser',
    ]);
    expect(labels.filter((label) => label === 'build')).toHaveLength(1);
    expect(HEALTH_STEPS.at(-1)?.argv).toEqual(['pnpm', 'test:e2e']);
  });
});
