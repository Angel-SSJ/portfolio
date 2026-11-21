import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { evaluateDoctor } from '../../scripts/lib/doctor.mjs';

type DoctorFacts = {
  runtimeMatches: boolean;
  pnpmMatches: boolean;
  identityMatches: boolean;
  hooksInstalled: boolean;
  vercelLinked: boolean;
  ciConfigured: boolean;
  secretsConfigured: boolean;
  externalRequested?: boolean;
};

const readyFacts: DoctorFacts = {
  runtimeMatches: true,
  pnpmMatches: true,
  identityMatches: true,
  hooksInstalled: true,
  vercelLinked: true,
  ciConfigured: true,
  secretsConfigured: true,
};

describe('doctor facts', () => {
  it('separates local readiness from external readiness', () => {
    expect(evaluateDoctor(readyFacts)).toEqual({
      localReady: true,
      externalReady: true,
      errors: [],
      warnings: [],
    });

    const pending = evaluateDoctor({
      ...readyFacts,
      vercelLinked: false,
      ciConfigured: false,
    });
    expect(pending.localReady).toBe(true);
    expect(pending.externalReady).toBe(false);
    expect(pending.errors).toEqual([]);
    expect(pending.warnings).toContain('vercel-not-linked');
    expect(pending.warnings).toContain('ci-not-configured');
  });

  it('reports missing local prerequisites and fails external checks', () => {
    const failed = evaluateDoctor({
      runtimeMatches: false,
      pnpmMatches: false,
      identityMatches: false,
      hooksInstalled: false,
      vercelLinked: false,
      ciConfigured: true,
      secretsConfigured: true,
      externalRequested: true,
    });

    expect(failed.localReady).toBe(false);
    expect(failed.externalReady).toBe(false);
    expect(failed.errors).toContain('runtime-mismatch');
    expect(failed.errors).toContain('pnpm-mismatch');
    expect(failed.errors).toContain('identity-mismatch');
    expect(failed.errors).toContain('hooks-not-installed');
    expect(failed.errors).toContain('vercel-not-linked');
  });

  it('never prints a supplied secret in CLI output', () => {
    const secret = 'diagnostic-secret-do-not-print';
    const result = spawnSync(process.execPath, ['scripts/doctor.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, PORTFOLIO_TEST_SECRET: secret },
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    expect(output).not.toContain(secret);
  });
});
