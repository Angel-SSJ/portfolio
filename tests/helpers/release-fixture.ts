import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OWNER = {
  name: 'Angel Ramirez',
  email: 'angelgabriel.16ra@gmail.com',
};

const ROOT = process.env.PORTFOLIO_ROOT ?? process.cwd();

export type ReleaseFixture = {
  cwd: string;
  origin: string;
  git: (args: string[], env?: Record<string, string>) => string;
  write: (relativePath: string, contents: string) => void;
  commit: (message: string) => string;
  run: (
    script: string,
    args?: string[],
    env?: Record<string, string>,
  ) => string;
  snapshot: () => {
    head: string;
    tags: string[];
    originRefs: string;
    files: string[];
  };
  cleanup: () => void;
};

function releaseEnv(env: Record<string, string> = {}): NodeJS.ProcessEnv {
  const localPnpmBins = [
    path.join(ROOT, '.tools', 'pnpm', 'node_modules', '.bin'),
    path.join(ROOT, '.tools', 'pnpm', 'node_modules', 'pnpm', 'bin'),
  ];
  const pathKey =
    Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ??
    'PATH';
  const currentPath = process.env[pathKey] ?? '';

  return {
    ...process.env,
    [pathKey]: [...localPnpmBins, currentPath]
      .filter(Boolean)
      .join(path.delimiter),
    ...env,
  };
}

function run(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: releaseEnv(env),
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function inside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

export function createReleaseFixture(version = '0.0.0'): ReleaseFixture {
  const base = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-release-fixture-')),
  );
  const cwd = path.join(base, 'work');
  const origin = path.join(base, 'origin.git');

  fs.mkdirSync(cwd);
  run('git', ['init', '--bare', '--quiet', origin], base);
  run('git', ['init', '--initial-branch=main', '--quiet'], cwd);

  const git = (args: string[], env: Record<string, string> = {}): string =>
    run('git', args, cwd, env);

  git(['config', 'user.name', OWNER.name]);
  git(['config', 'user.email', OWNER.email]);
  git(['config', 'commit.gpgsign', 'false']);
  git(['config', 'tag.gpgsign', 'false']);
  git(['config', 'core.autocrlf', 'false']);
  git(['remote', 'add', 'origin', origin]);

  const write = (relativePath: string, contents: string): void => {
    const target = path.resolve(cwd, relativePath);

    if (!inside(target, cwd)) {
      throw new Error(`Refusing to write outside fixture: ${relativePath}`);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  };

  write(
    'package.json',
    `${JSON.stringify(
      {
        name: 'portfolio-fixture',
        version,
        private: true,
        type: 'module',
        packageManager: 'pnpm@12.21.0',
        engines: { node: '26.x' },
      },
      null,
      2,
    )}\n`,
  );
  write('CHANGELOG.md', '# Changelog\n\n## Unreleased\n');
  write('pnpm-lock.yaml', "lockfileVersion: '9.0'\n\nimporters:\n  .: {}\n");
  write('README.md', 'fixture\n');

  for (const entry of [
    'scripts',
    '.release-it.json',
    '.release-it.prepare.json',
  ]) {
    fs.cpSync(path.join(ROOT, entry), path.join(cwd, entry), {
      recursive: true,
      force: true,
    });
  }

  const commit = (message: string): string => {
    git(['add', '--all']);
    git(['commit', '--no-gpg-sign', '--quiet', '-m', message]);
    return git(['rev-parse', 'HEAD']);
  };

  commit('chore: initialize fixture');
  git(['push', '--quiet', '-u', 'origin', 'main']);

  const runScript = (
    script: string,
    args: string[] = [],
    env: Record<string, string> = {},
  ): string =>
    run(process.execPath, [path.join(ROOT, script), ...args], cwd, {
      ...env,
      PORTFOLIO_ROOT: ROOT,
    });

  const snapshot = () => {
    const files = git(['ls-files'])
      .split('\n')
      .filter(Boolean)
      .sort()
      .map((file) => {
        const digest = createHash('sha256')
          .update(fs.readFileSync(path.join(cwd, file)))
          .digest('hex');
        return `${file}:${digest}`;
      });

    return {
      head: git(['rev-parse', 'HEAD']),
      tags: git(['tag', '--list']).split('\n').filter(Boolean).sort(),
      originRefs: git(['ls-remote', 'origin']),
      files,
    };
  };

  const cleanup = (): void => {
    if (!fs.existsSync(base)) {
      return;
    }

    const resolved = fs.realpathSync(base);

    if (!inside(resolved, base)) {
      throw new Error(`Refusing to remove path outside fixture: ${resolved}`);
    }

    fs.rmSync(resolved, { recursive: true, force: true });
  };

  return { cwd, origin, git, write, commit, run: runScript, snapshot, cleanup };
}
