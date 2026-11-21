import { describe, expect, it } from 'vitest';
import {
  createReleaseServices,
  validateTag,
} from '../../scripts/lib/releases.mjs';
import { verifyRelease } from '../../scripts/verify-release.mjs';
import { createGitFixture } from '../helpers/git-fixture.ts';

const ownerName = 'Angel Ramirez';
const ownerEmail = 'angelgabriel.16ra@gmail.com';

const validOwnerTag = {
  tagName: 'v0.1.0',
  packageVersion: '0.1.0',
  commitSha: '1111111111111111111111111111111111111111',
  onMain: true,
  annotated: true,
  taggerName: ownerName,
  taggerEmail: ownerEmail,
};

const localFacts = {
  branch: 'main',
  upstreamSha: '1111111111111111111111111111111111111111',
  headSha: '1111111111111111111111111111111111111111',
  packageVersion: '0.1.0',
  clean: true,
  user: { name: ownerName, email: ownerEmail },
  tag: null,
};

const remoteFacts = {
  mainSha: '1111111111111111111111111111111111111111',
  onMain: true,
};

const ciSuccess = {
  status: 'success',
  sha: '1111111111111111111111111111111111111111',
};

function makeServices(overrides = {}) {
  return {
    async local() {
      return { ...localFacts, user: { ...localFacts.user } };
    },
    async remote() {
      return { ...remoteFacts };
    },
    async ci() {
      return { ...ciSuccess };
    },
    ...overrides,
  };
}

describe('validateTag', () => {
  it('accepts an annotated owner tag matching the package and main history', () => {
    expect(validateTag(validOwnerTag)).toEqual([]);
  });

  it('rejects a lightweight tag', () => {
    expect(validateTag({ ...validOwnerTag, annotated: false })).toContain(
      'tag-not-annotated',
    );
  });

  it('rejects a tagger other than the owner', () => {
    expect(validateTag({ ...validOwnerTag, taggerName: 'Codex' })).toContain(
      'tagger-mismatch',
    );
  });

  it('rejects a package version mismatch', () => {
    expect(
      validateTag({ ...validOwnerTag, packageVersion: '0.2.0' }),
    ).toContain('version-mismatch');
  });

  it('rejects a commit outside main', () => {
    expect(validateTag({ ...validOwnerTag, onMain: false })).toContain(
      'commit-not-on-main',
    );
  });

  it('rejects prerelease and non-production tag names', () => {
    expect(validateTag({ ...validOwnerTag, tagName: 'v0.1.0-rc.1' })).toContain(
      'invalid-tag',
    );
    expect(
      validateTag({ ...validOwnerTag, tagName: 'release-0.1.0' }),
    ).toContain('invalid-tag');
  });
});

describe('verifyRelease', () => {
  it('passes local mode when synchronized main, identity, version, tag and CI align', async () => {
    const result = await verifyRelease({
      cwd: process.cwd(),
      mode: 'local',
      services: makeServices(),
    });

    expect(result.errors).toEqual([]);
  });

  it('refuses local mode when remote main is stale', async () => {
    const result = await verifyRelease({
      cwd: process.cwd(),
      mode: 'local',
      services: makeServices({
        async remote() {
          return {
            ...remoteFacts,
            mainSha: '2222222222222222222222222222222222222222',
          };
        },
      }),
    });

    expect(result.errors).toContain('main-not-synchronized');
  });

  it('refuses local mode with a dirty tree', async () => {
    const result = await verifyRelease({
      cwd: process.cwd(),
      mode: 'local',
      services: makeServices({
        async local() {
          return {
            ...localFacts,
            clean: false,
            user: { ...localFacts.user },
          };
        },
      }),
    });

    expect(result.errors).toContain('working-tree-not-clean');
  });

  it('never treats a CI failure or wrong SHA as successful preflight', async () => {
    const failure = await verifyRelease({
      cwd: process.cwd(),
      mode: 'local',
      services: makeServices({
        async ci() {
          return { status: 'failure', sha: ciSuccess.sha };
        },
      }),
    });
    const wrongSha = await verifyRelease({
      cwd: process.cwd(),
      mode: 'local',
      services: makeServices({
        async ci() {
          return {
            status: 'success',
            sha: '2222222222222222222222222222222222222222',
          };
        },
      }),
    });

    expect(failure.errors).toContain('ci-unverified');
    expect(wrongSha.errors).toContain('ci-wrong-sha');
  });

  it('accepts a verified tag from a detached checkout without a local tracking branch', async () => {
    const tag = {
      name: 'v0.1.0',
      exists: true,
      annotated: true,
      taggerName: ownerName,
      taggerEmail: ownerEmail,
      sha: validOwnerTag.commitSha,
    };
    const result = await verifyRelease({
      cwd: process.cwd(),
      mode: 'tag',
      tagName: 'v0.1.0',
      services: makeServices({
        async local() {
          return {
            branch: null,
            upstreamSha: null,
            headSha: tag.sha,
            packageVersion: '0.1.0',
            clean: true,
            user: { name: ownerName, email: ownerEmail },
            tag,
          };
        },
      }),
    });

    expect(result.errors).toEqual([]);
  });

  it('refuses a tag whose tagger is not the owner', async () => {
    const tag = {
      name: 'v0.1.0',
      exists: true,
      annotated: true,
      taggerName: 'Codex',
      taggerEmail: ownerEmail,
      sha: validOwnerTag.commitSha,
    };
    const result = await verifyRelease({
      cwd: process.cwd(),
      mode: 'tag',
      tagName: 'v0.1.0',
      services: makeServices({
        async local() {
          return {
            branch: null,
            upstreamSha: null,
            headSha: tag.sha,
            packageVersion: '0.1.0',
            clean: true,
            user: { name: ownerName, email: ownerEmail },
            tag,
          };
        },
      }),
    });

    expect(result.errors).toContain('tagger-mismatch');
  });
});

describe('createReleaseServices', () => {
  it('normalizes the tagger email reported by for-each-ref', async () => {
    const fixture = createGitFixture();

    try {
      fixture.write('package.json', JSON.stringify({ version: '0.1.0' }));
      fixture.write('tracked.txt', 'content\n');
      fixture.commit('chore: prepare tag');
      fixture.git([
        'tag',
        '--annotate',
        '--message',
        'Release 0.1.0',
        'v0.1.0',
      ]);

      const { tag } = await createReleaseServices(fixture.cwd).local('v0.1.0');

      expect(tag?.annotated).toBe(true);
      expect(tag?.taggerEmail).toBe(ownerEmail);
    } finally {
      fixture.cleanup();
    }
  });
});
