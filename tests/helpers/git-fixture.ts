import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OWNER = {
  name: 'Angel Ramirez',
  email: 'angelgabriel.16ra@gmail.com',
};

export type CommitOptions = {
  authorName?: string;
  authorEmail?: string;
  committerName?: string;
  committerEmail?: string;
};

export type GitFixture = {
  cwd: string;
  git: (args: string[], env?: Record<string, string>) => string;
  write: (relativePath: string, contents: string) => void;
  commit: (message: string, options?: CommitOptions) => string;
  cleanup: () => void;
};

function normalize(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

export function createGitFixture(): GitFixture {
  const created = fs.mkdtempSync(
    path.join(os.tmpdir(), 'portfolio-git-fixture-'),
  );
  const cwd = fs.realpathSync(created);
  const ownerName = OWNER.name;
  const ownerEmail = OWNER.email;

  const git = (args: string[], env: Record<string, string> = {}): string =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  git(['init', '--initial-branch=main', '--quiet']);
  git(['config', 'user.name', ownerName]);
  git(['config', 'user.email', ownerEmail]);
  git(['config', 'commit.gpgsign', 'false']);
  git(['config', 'tag.gpgsign', 'false']);
  git(['config', 'core.autocrlf', 'false']);

  const write = (relativePath: string, contents: string): void => {
    const target = path.resolve(cwd, relativePath);

    if (!isInside(target, cwd)) {
      throw new Error(`Refusing to write outside fixture: ${relativePath}`);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  };

  const commit = (message: string, options: CommitOptions = {}): string => {
    const authorName = options.authorName ?? ownerName;
    const authorEmail = options.authorEmail ?? ownerEmail;
    const env: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    if (options.committerName !== undefined) {
      env.GIT_COMMITTER_NAME = options.committerName;
    }
    if (options.committerEmail !== undefined) {
      env.GIT_COMMITTER_EMAIL = options.committerEmail;
    }

    const args = [
      'commit',
      '--no-gpg-sign',
      '--quiet',
      '-m',
      message,
      '--author',
      `${authorName} <${authorEmail}>`,
    ];

    git(['add', '--all'], env);
    git(args, env);

    return git(['rev-parse', 'HEAD'], env).trim();
  };

  const cleanup = (): void => {
    if (!fs.existsSync(cwd)) {
      return;
    }

    const resolved = fs.realpathSync(cwd);

    if (!isInside(normalize(resolved), normalize(cwd))) {
      throw new Error(`Refusing to remove path outside fixture: ${resolved}`);
    }

    fs.rmSync(resolved, { recursive: true, force: true });
  };

  return { cwd, git, write, commit, cleanup };
}
