import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectRepository } from '../../scripts/lib/repository.mjs';

type PackageJson = {
  private?: boolean;
  packageManager?: string;
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

type FixtureOptions = {
  package?: (pkg: PackageJson) => void;
  files?: Record<string, string>;
  tracked?: string[];
};

const root = process.cwd();
const sourcePackage = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const sourceFiles: Record<string, string> = {
  'package.json': sourcePackage,
  '.node-version': fs.readFileSync(path.join(root, '.node-version'), 'utf8'),
  'pnpm-workspace.yaml': fs.readFileSync(
    path.join(root, 'pnpm-workspace.yaml'),
    'utf8',
  ),
  'vitest.config.ts': fs.readFileSync(
    path.join(root, 'vitest.config.ts'),
    'utf8',
  ),
  'vitest.integration.config.ts': fs.readFileSync(
    path.join(root, 'vitest.integration.config.ts'),
    'utf8',
  ),
  'playwright.config.ts': fs.readFileSync(
    path.join(root, 'playwright.config.ts'),
    'utf8',
  ),
  'astro.config.mjs': fs.readFileSync(
    path.join(root, 'astro.config.mjs'),
    'utf8',
  ),
};

const fixtures: string[] = [];

function createFixture(options: FixtureOptions = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-repo-'));
  fixtures.push(cwd);
  execFileSync('git', ['init', '--quiet'], { cwd });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], {
    cwd,
    stdio: 'ignore',
  });

  for (const [file, content] of Object.entries(sourceFiles)) {
    fs.writeFileSync(path.join(cwd, file), content, 'utf8');
  }

  const pkg = JSON.parse(sourcePackage) as PackageJson;
  options.package?.(pkg);
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    `${JSON.stringify(pkg, null, 2)}\n`,
    'utf8',
  );

  for (const [file, content] of Object.entries(options.files ?? {})) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), content, 'utf8');
  }

  for (const file of options.tracked ?? []) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), 'tracked\n', 'utf8');
  }

  execFileSync('git', ['add', '--all'], { cwd });
  return cwd;
}

afterEach(() => {
  for (const cwd of fixtures.splice(0)) {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

describe('repository invariants', () => {
  it('accepts the real repository configuration', async () => {
    const result = await inspectRepository({ cwd: root });

    expect(result.errors).toEqual([]);
  });

  it('rejects a non-private package', async () => {
    const cwd = createFixture({
      package(pkg) {
        pkg.private = false;
      },
    });

    const result = await inspectRepository({ cwd });

    expect(result.errors).toContain('private-package-required');
  });

  it('rejects a range dependency instead of an exact pin', async () => {
    const cwd = createFixture({
      package(pkg) {
        if (pkg.devDependencies) {
          pkg.devDependencies.vitest = '^5.1.1';
        }
      },
    });

    const result = await inspectRepository({ cwd });

    expect(result.errors).toContain('dependency-pins-required');
  });

  it('rejects browser specs in a Vitest project', async () => {
    const cwd = createFixture({
      files: {
        'vitest.config.ts': `${sourceFiles['vitest.config.ts']}\n// include tests/e2e/**/*.spec.ts`,
      },
    });

    const result = await inspectRepository({ cwd });

    expect(result.errors).toContain('vitest-browser-boundary');
  });

  it('rejects forbidden tracked artifacts', async () => {
    const cwd = createFixture({
      tracked: ['.env', 'dist/index.html', 'node_modules/.pnpm/lock.yaml'],
    });

    const result = await inspectRepository({ cwd });

    expect(result.errors).toContain('forbidden-tracked-artifact');
  });

  it('rejects server routes in a static production path', async () => {
    const cwd = createFixture({
      tracked: ['src/pages/api/status.ts'],
    });

    const result = await inspectRepository({ cwd });

    expect(result.errors).toContain('static-production-only');
  });
});
