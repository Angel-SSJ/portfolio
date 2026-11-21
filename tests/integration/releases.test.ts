import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createReleaseServices } from '../../scripts/lib/releases.mjs';
import { finalizeRelease } from '../../scripts/finalize-release.mjs';
import {
  createReleaseFixture,
  type ReleaseFixture,
} from '../helpers/release-fixture.ts';

const fixtures: ReleaseFixture[] = [];

function track<T extends ReleaseFixture>(fixture: T): T {
  fixtures.push(fixture);
  return fixture;
}

function servicesFor(fixture: ReleaseFixture, sha: string) {
  return {
    ...createReleaseServices(fixture.cwd),
    async ci() {
      return { status: 'success', sha };
    },
  };
}

function pushAheadCommit(fixture: ReleaseFixture): string {
  const clone = path.join(path.dirname(fixture.cwd), 'other');
  const run = (args: string[]): string =>
    execFileSync('git', args, {
      cwd: clone,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

  execFileSync('git', ['clone', '--quiet', fixture.origin, clone], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  run(['config', 'user.name', 'Angel Ramirez']);
  run(['config', 'user.email', 'angelgabriel.16ra@gmail.com']);
  run(['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(clone, 'remote-change.txt'), 'remote\n', 'utf8');
  run(['add', '--all']);
  run(['commit', '--no-gpg-sign', '--quiet', '-m', 'docs: remote change']);
  run(['push', '--quiet', 'origin', 'main']);

  return run(['rev-parse', 'HEAD']);
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fixture.cleanup();
  }
});

describe('release phase boundaries', () => {
  it('prepares version, changelog and lock metadata without mutating git', () => {
    const fixture = track(createReleaseFixture());
    fixture.git(['checkout', '--quiet', '-b', 'codex/release-v0.1.0']);
    const before = fixture.snapshot();

    fixture.run('scripts/prepare-release.mjs', ['0.1.0']);

    const after = fixture.snapshot();
    const changed = after.files
      .filter((file, index) => file !== before.files[index])
      .map((file) => file.split(':')[0]);

    expect(changed).toEqual(['CHANGELOG.md', 'package.json', 'pnpm-lock.yaml']);
    expect(after.head).toBe(before.head);
    expect(after.tags).toEqual(before.tags);
    expect(after.originRefs).toBe(before.originRefs);
  });

  it('finalizes in tag mode with one owner tag and no tracked-file changes', async () => {
    const fixture = track(createReleaseFixture('0.1.0'));
    const before = fixture.snapshot();
    const services = servicesFor(fixture, before.head);

    const result = await finalizeRelease({
      cwd: fixture.cwd,
      tagName: 'v0.1.0',
      services,
    });

    expect(result.errors).toEqual([]);

    const after = fixture.snapshot();
    expect(after.head).toBe(before.head);
    expect(after.files).toEqual(before.files);
    expect(after.tags).toEqual(['v0.1.0']);
    expect(after.originRefs).toContain('refs/tags/v0.1.0');
    expect(fixture.git(['cat-file', '-t', 'v0.1.0'])).toBe('tag');
    expect(
      fixture.git([
        'for-each-ref',
        '--format=%(taggername)|%(taggeremail)',
        'refs/tags/v0.1.0',
      ]),
    ).toBe('Angel Ramirez|<angelgabriel.16ra@gmail.com>');
  });

  it('does not create a duplicate tag on a second finalization', async () => {
    const fixture = track(createReleaseFixture('0.1.0'));
    const before = fixture.snapshot();
    const services = servicesFor(fixture, before.head);

    await finalizeRelease({ cwd: fixture.cwd, tagName: 'v0.1.0', services });
    const afterFirst = fixture.snapshot();
    const result = await finalizeRelease({
      cwd: fixture.cwd,
      tagName: 'v0.1.0',
      services,
    });
    const afterSecond = fixture.snapshot();

    expect(result.errors).toEqual([]);
    expect(afterSecond).toEqual(afterFirst);
  });

  it('refuses a finalization dry run and leaves no tag', async () => {
    const fixture = track(createReleaseFixture('0.1.0'));
    const before = fixture.snapshot();
    const services = servicesFor(fixture, before.head);

    const result = await finalizeRelease({
      cwd: fixture.cwd,
      tagName: 'v0.1.0',
      services,
      dryRun: true,
    });

    expect(result.errors).toEqual([]);
    expect(fixture.snapshot()).toEqual(before);
  });

  it('refuses a dirty tree before any tag or push', async () => {
    const fixture = track(createReleaseFixture('0.1.0'));
    const before = fixture.snapshot();
    const services = servicesFor(fixture, before.head);
    fixture.write('dirty.txt', 'dirty\n');

    const result = await finalizeRelease({
      cwd: fixture.cwd,
      tagName: 'v0.1.0',
      services,
    });

    expect(result.errors).toContain('working-tree-not-clean');
    expect(fixture.git(['tag', '--list'])).toBe('');
    expect(fixture.snapshot().originRefs).toBe(before.originRefs);
  });

  it('refuses a stale remote before any tag or push', async () => {
    const fixture = track(createReleaseFixture('0.1.0'));
    const before = fixture.snapshot();
    const services = servicesFor(fixture, before.head);
    pushAheadCommit(fixture);

    const result = await finalizeRelease({
      cwd: fixture.cwd,
      tagName: 'v0.1.0',
      services,
    });

    expect(result.errors).toContain('main-not-synchronized');
    expect(fixture.git(['tag', '--list'])).toBe('');
    expect(fixture.git(['ls-remote', 'origin', 'refs/tags/v0.1.0'])).toBe('');
  });
});
