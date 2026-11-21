import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectDoctorFacts,
  evaluateDoctor,
} from '../../scripts/lib/doctor.mjs';

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

  it('does not claim deployment secrets are configured from a local token', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-doctor-'));
    const previousToken = process.env.VERCEL_TOKEN;

    try {
      fs.mkdirSync(path.join(cwd, '.vercel'));
      fs.writeFileSync(
        path.join(cwd, '.vercel/project.json'),
        `${JSON.stringify({ orgId: 'org', projectId: 'project' })}\n`,
        'utf8',
      );
      process.env.VERCEL_TOKEN = 'diagnostic-secret-do-not-print';

      expect(collectDoctorFacts({ cwd }).secretsConfigured).toBe(false);
    } finally {
      if (previousToken === undefined) {
        delete process.env.VERCEL_TOKEN;
      } else {
        process.env.VERCEL_TOKEN = previousToken;
      }
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('never prints a supplied secret in CLI output', () => {
    const secret = 'diagnostic-secret-do-not-print';
    const result = spawnSync(process.execPath, ['scripts/doctor.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, VERCEL_TOKEN: secret },
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    expect(output).not.toContain(secret);
  });
});
