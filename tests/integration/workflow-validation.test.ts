import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function runWorkflowCheck(cwd: string): string {
  return execFileSync(
    process.execPath,
    [path.join(root, 'scripts/check-workflows.mjs')],
    {
      cwd,
      encoding: 'utf8',
    },
  );
}

describe('workflow validation', () => {
  it('accepts the checked-in workflows', () => {
    expect(runWorkflowCheck(root)).toContain('Workflow validation passed.');
  });

  it('installs browsers before the deploy smoke tests', () => {
    const deploy = fs.readFileSync(
      path.join(root, '.github/workflows/deploy.yml'),
      'utf8',
    );

    const installIndex = deploy.indexOf('playwright install --with-deps');
    const smokeIndex = deploy.indexOf('PORTFOLIO_STAGED_SMOKE=1 pnpm test:e2e');

    expect(installIndex).toBeGreaterThan(-1);
    expect(smokeIndex).toBeGreaterThan(installIndex);
  });

  it('accepts configured repository variables in workflow expressions', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-vars-'));

    try {
      fs.mkdirSync(path.join(cwd, '.github/workflows'), { recursive: true });
      fs.writeFileSync(
        path.join(cwd, '.github/workflows/vars.yml'),
        `name: Vars\non: push\njobs:\n  ok:\n    runs-on: ubuntu-latest\n    steps:\n      - env:\n          PROJECT: \${{ vars.VERCEL_PROJECT_ID }}\n          ORG: \${{ vars.VERCEL_ORG_ID }}\n        run: echo "$PROJECT $ORG"\n`,
        'utf8',
      );

      expect(runWorkflowCheck(cwd)).toContain('Workflow validation passed.');
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('rejects unconfigured repository variables', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-vars-'));

    try {
      fs.mkdirSync(path.join(cwd, '.github/workflows'), { recursive: true });
      fs.writeFileSync(
        path.join(cwd, '.github/workflows/vars.yml'),
        `name: Vars\non: push\njobs:\n  ok:\n    runs-on: ubuntu-latest\n    steps:\n      - env:\n          UNKNOWN: \${{ vars.UNKNOWN }}\n        run: echo "$UNKNOWN"\n`,
        'utf8',
      );

      expect(() => runWorkflowCheck(cwd)).toThrow();
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('validates and excludes the staged deployment before promotion', () => {
    const deploy = fs.readFileSync(
      path.join(root, '.github/workflows/deploy.yml'),
      'utf8',
    );

    expect(deploy).toContain(
      'STAGED_URL="$url" node scripts/verify-staged-deployment.mjs',
    );
    expect(deploy).toContain(
      'EXCLUDED_DEPLOYMENT_URL: $' + '{{ steps.stage.outputs.url }}',
    );
    expect(deploy).not.toContain('vercel inspect "$url" --json');
    expect(deploy).not.toContain('gh variable get');
    expect(deploy).not.toContain('actions: read');
    expect(deploy).toContain('checks: read');
    expect(deploy).toContain(`VERCEL_ORG_ID: \${{ vars.VERCEL_ORG_ID }}`);
  });

  it('rejects an invalid workflow instead of silently skipping it', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-workflows-'));

    try {
      fs.mkdirSync(path.join(cwd, '.github/workflows'), { recursive: true });
      fs.writeFileSync(
        path.join(cwd, '.github/workflows/bad.yml'),
        'name: Bad\non: push\njobs:\n  broken:\n    steps: []\n',
        'utf8',
      );

      expect(() => runWorkflowCheck(cwd)).toThrow();
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
