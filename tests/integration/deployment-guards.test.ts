import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createReleaseFixture,
  type ReleaseFixture,
} from '../helpers/release-fixture.ts';

const root = process.cwd();
const fixtures: ReleaseFixture[] = [];
const tempDirs: string[] = [];

const candidate = {
  candidateVersion: '1.2.0',
  candidateSha: '1111111111111111111111111111111111111111',
  expectedSha: '1111111111111111111111111111111111111111',
  latestSuccessfulVersion: '1.1.0',
  deployedVersion: '1.1.0',
  deployedSha: '0000000000000000000000000000000000000000',
  requiredChecksSucceeded: true,
  smokeSucceeded: true,
};

function promotionCli(facts: Record<string, unknown>, phase: string) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-promotion-'));
  tempDirs.push(cwd);
  const file = path.join(cwd, 'facts.json');
  fs.writeFileSync(file, JSON.stringify(facts), 'utf8');

  return spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts/check-promotion.mjs'),
      '--phase',
      phase,
      '--facts-file',
      file,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PORTFOLIO_TEST_FIXTURES: '1' },
    },
  );
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fixture.cleanup();
  }

  for (const cwd of tempDirs.splice(0)) {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

describe('deployment guards', () => {
  it('rejects an invalid release tag', () => {
    const fixture = createReleaseFixture('0.1.0');
    fixtures.push(fixture);
    fixture.git(['tag', '-a', 'v0.1.0-beta.1', '-m', 'bad tag']);

    expect(() =>
      fixture.run('scripts/verify-release.mjs', ['--tag', 'v0.1.0-beta.1']),
    ).toThrow();
  });

  it('rejects a stale promotion through the CLI', () => {
    const result = promotionCli(
      { ...candidate, candidateVersion: '1.0.0' },
      'promotion',
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('"action":"reject"');
  });

  it('rejects a promotion with failed CI facts', () => {
    const result = promotionCli(
      { ...candidate, requiredChecksSucceeded: false },
      'promotion',
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('"action":"reject"');
  });

  it('rejects a promotion with failed staging smoke facts', () => {
    const result = promotionCli(
      { ...candidate, smokeSucceeded: false },
      'promotion',
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('"action":"reject"');
  });

  it('rejects promotion when remote inspection fails', () => {
    const result = promotionCli({ inspectError: true }, 'promotion');

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('"reason":"facts-unavailable"');
  });

  it('stages a confirmed empty first publication', () => {
    const result = promotionCli(
      {
        ...candidate,
        latestSuccessfulVersion: null,
        deployedVersion: null,
        deployedSha: null,
      },
      'preflight',
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ action: 'stage' });
  });
});
