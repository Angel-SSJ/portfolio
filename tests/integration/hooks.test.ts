import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createGitFixture, type GitFixture } from '../helpers/git-fixture';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

type RunResult = { status: number; stdout: string; stderr: string };
type Fixture = { repo: GitFixture; env: Record<string, string> };

function run(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
): RunResult {
  try {
    const stdout = execFileSync(command, args, {
      cwd,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failure = (error && typeof error === 'object' ? error : {}) as {
      status?: unknown;
      stdout?: unknown;
      stderr?: unknown;
    };
    return {
      status: typeof failure.status === 'number' ? failure.status : 1,
      stdout: typeof failure.stdout === 'string' ? failure.stdout : '',
      stderr: typeof failure.stderr === 'string' ? failure.stderr : '',
    };
  }
}

describe('Lefthook integration', () => {
  const fixtures: GitFixture[] = [];

  const setup = (): Fixture => {
    const repo = createGitFixture();
    fixtures.push(repo);

    repo.write('.gitignore', 'node_modules/\n');
    repo.write('base.txt', 'base\n');
    repo.commit('chore: fixture base');

    fs.cpSync(path.join(root, 'scripts'), path.join(repo.cwd, 'scripts'), {
      recursive: true,
    });
    fs.copyFileSync(
      path.join(root, 'lefthook.yml'),
      path.join(repo.cwd, 'lefthook.yml'),
    );
    for (const name of [
      'biome.json',
      'eslint.config.mjs',
      'prettier.config.mjs',
    ]) {
      fs.copyFileSync(path.join(root, name), path.join(repo.cwd, name));
    }

    const env = {
      PORTFOLIO_ROOT: root,
      LEFTHOOK_CONFIG: path.join(repo.cwd, 'lefthook.yml'),
    };
    const installed = run(
      process.execPath,
      [path.join(repo.cwd, 'scripts/install-hooks.mjs')],
      repo.cwd,
      env,
    );

    expect(installed.status, `${installed.stdout}${installed.stderr}`).toBe(0);
    return { repo, env };
  };

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()?.cleanup();
    }
  });

  it('rejects a non-conventional message and accepts a valid one', () => {
    const { repo, env } = setup();
    repo.write('message.txt', 'message\n');
    repo.git(['add', '--', 'message.txt']);

    const rejected = run(
      'git',
      ['commit', '--no-gpg-sign', '-m', 'invalid message'],
      repo.cwd,
      env,
    );
    expect(rejected.status).not.toBe(0);

    const accepted = run(
      'git',
      ['commit', '--no-gpg-sign', '-m', 'chore: verify commit policy'],
      repo.cwd,
      env,
    );
    expect(accepted.status).toBe(0);
    expect(repo.git(['log', '-1', '--pretty=%s']).trim()).toBe(
      'chore: verify commit policy',
    );
  });

  it('checks staged paths that contain spaces', () => {
    const { repo, env } = setup();
    repo.write('with space.ts', 'const broken = ;\n');
    repo.git(['add', '--', 'with space.ts']);

    const result = run(
      'git',
      ['commit', '--no-gpg-sign', '-m', 'chore: check spaced path'],
      repo.cwd,
      env,
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status, output).not.toBe(0);
    expect(output).toContain('with space.ts');
  });

  it('does not mutate index blobs or working-tree bytes for partially staged files', () => {
    const { repo, env } = setup();
    const target = path.join(repo.cwd, 'partial.ts');

    repo.write('partial.ts', 'const value = 1;\n');
    repo.git(['add', '--', 'partial.ts']);
    const stagedBefore = repo.git(['show', ':partial.ts']);

    repo.write('partial.ts', 'const value = ;\n');
    const workingBefore = fs.readFileSync(target, 'utf8');

    const result = run(
      'git',
      ['commit', '--no-gpg-sign', '-m', 'chore: check partial staging'],
      repo.cwd,
      env,
    );

    expect(result.status, `${result.stdout}${result.stderr}`).not.toBe(0);
    expect(repo.git(['show', ':partial.ts'])).toBe(stagedBefore);
    expect(fs.readFileSync(target, 'utf8')).toBe(workingBefore);
  });

  it('does nothing when no staged path matches a supported tool', () => {
    const { repo, env } = setup();
    const target = path.join(repo.cwd, 'notes.txt');

    repo.write('notes.txt', 'plain text\n');
    repo.git(['add', '--', 'notes.txt']);
    const bytesBefore = fs.readFileSync(target, 'utf8');

    const result = run(
      'git',
      ['commit', '--no-gpg-sign', '-m', 'chore: check unmatched files'],
      repo.cwd,
      env,
    );

    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect(fs.readFileSync(target, 'utf8')).toBe(bytesBefore);
    expect(repo.git(['diff', '--cached', '--name-only']).trim()).toBe('');
  });
});
