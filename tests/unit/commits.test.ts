import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  identityErrors,
  messageErrors,
  readCommits,
} from '../../scripts/lib/commits.mjs';
import { createGitFixture, type GitFixture } from '../helpers/git-fixture';

const configPath = path.resolve(process.cwd(), 'commitlint.config.mjs');

function defined<T>(value: T | undefined): T {
  expect(value).toBeDefined();

  if (value === undefined) {
    throw new Error('Expected a defined value');
  }

  return value;
}

describe('commit policy', () => {
  const fixtures: GitFixture[] = [];

  const fixture = () => {
    const created = createGitFixture();
    fixtures.push(created);
    return created;
  };

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()?.cleanup();
    }
  });

  it('reads a root commit with no parent and exact owner identity', async () => {
    const repo = fixture();
    repo.write('README.md', 'fixture\n');
    const rootSha = repo.commit('chore: initial fixture commit');

    const commits = await readCommits({
      cwd: repo.cwd,
      head: 'HEAD',
      base: null,
    });

    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      sha: rootSha,
      message: 'chore: initial fixture commit',
      authorName: 'Angel Ramirez',
      authorEmail: 'angelgabriel.16ra@gmail.com',
      committerName: 'Angel Ramirez',
      committerEmail: 'angelgabriel.16ra@gmail.com',
    });
    expect(identityErrors(defined(commits[0]))).toEqual([]);
  });

  it('inspects every commit in a base..head range, including an earlier invalid message', async () => {
    const repo = fixture();
    repo.write('a.txt', 'a\n');
    const base = repo.commit('chore: base');
    repo.write('b.txt', 'b\n');
    repo.commit('invalid message');
    repo.write('c.txt', 'c\n');
    repo.commit('chore: valid later commit');

    const commits = await readCommits({ cwd: repo.cwd, head: 'HEAD', base });

    expect(commits).toHaveLength(2);
    const invalid = commits.find(
      (commit) => commit.message === 'invalid message',
    );
    expect(
      messageErrors(defined(invalid), { configPath, cwd: process.cwd() }),
    ).not.toEqual([]);
    expect(commits.map((commit) => commit.message)).toContain(
      'chore: valid later commit',
    );
    expect(identityErrors(defined(commits[1]))).toEqual([]);
  });

  it('retains a non-fast-forward merge commit with exact owner identity', async () => {
    const repo = fixture();
    repo.write('base.txt', 'base\n');
    repo.commit('chore: base');

    repo.git(['checkout', '-b', 'feature', '--quiet']);
    repo.write('feature.txt', 'feature\n');
    repo.commit('feat: add fixture feature');

    repo.git(['checkout', 'main', '--quiet']);
    repo.git([
      'merge',
      '--no-ff',
      '--no-gpg-sign',
      '-m',
      'chore: merge fixture feature',
      'feature',
    ]);

    const commits = await readCommits({
      cwd: repo.cwd,
      head: 'HEAD',
      base: null,
    });
    const merge = commits.find(
      (commit) => commit.message === 'chore: merge fixture feature',
    );

    expect(identityErrors(defined(merge))).toEqual([]);
    expect(
      messageErrors(defined(merge), { configPath, cwd: process.cwd() }),
    ).toEqual([]);
  });

  it('fails when the committer is someone else even if the author is the owner', async () => {
    const repo = fixture();
    repo.write('base.txt', 'base\n');
    repo.commit('chore: base');
    repo.write('bad.txt', 'bad\n');
    repo.commit('chore: wrong committer', {
      committerName: 'Someone Else',
      committerEmail: 'other@example.com',
    });

    const commits = await readCommits({
      cwd: repo.cwd,
      head: 'HEAD',
      base: null,
    });
    const bad = commits.find(
      (commit) => commit.message === 'chore: wrong committer',
    );

    expect(identityErrors(defined(bad))).toContain('committerName');
    expect(identityErrors(defined(bad))).toContain('committerEmail');
    expect(
      identityErrors(
        defined(commits.find((commit) => commit.message === 'chore: base')),
      ),
    ).toEqual([]);
  });

  it('rejects missing and zero bases instead of silently checking only HEAD', async () => {
    const repo = fixture();
    repo.write('base.txt', 'base\n');
    repo.commit('chore: base');

    await expect(
      readCommits({ cwd: repo.cwd, head: 'HEAD', base: 'does-not-exist' }),
    ).rejects.toThrow(/Cannot resolve "does-not-exist"/);
    await expect(
      readCommits({ cwd: repo.cwd, head: 'HEAD', base: '0'.repeat(40) }),
    ).rejects.toThrow(/Invalid commit SHA/);
  });
});
