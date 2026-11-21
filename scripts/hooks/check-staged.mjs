import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const root = process.env.PORTFOLIO_ROOT
  ? path.resolve(process.env.PORTFOLIO_ROOT)
  : scriptRoot;
const require = createRequire(path.join(root, 'package.json'));

const cwd = process.cwd();
const config = {
  biome: path.join(cwd, 'biome.json'),
  eslint: path.join(cwd, 'eslint.config.mjs'),
  prettier: path.join(cwd, 'prettier.config.mjs'),
};

/**
 * @param {string} packageName
 * @param {string} relativePath
 * @returns {string}
 */
function tool(packageName, relativePath) {
  return path.join(
    path.dirname(require.resolve(`${packageName}/package.json`)),
    relativePath,
  );
}

/**
 * @param {string} label
 * @param {string} binary
 * @param {string[]} args
 */
function run(label, binary, args) {
  try {
    execFileSync(process.execPath, [binary, ...args], {
      cwd,
      stdio: 'inherit',
    });
  } catch {
    console.error(`${label} failed`);
    process.exitCode = 1;
  }
}

const supplied = process.argv.slice(2);
const files = supplied.filter(
  (file) => path.basename(file).toLowerCase() !== 'readme.md',
);
const astroFiles = files.filter((file) => /\.astro$/i.test(file));
const biomeFiles = files.filter((file) =>
  /\.(?:cjs|css|js|json|jsonc|mjs|md|ts|ya?ml)$/i.test(file),
);

if (biomeFiles.length > 0) {
  run('Biome format', tool('@biomejs/biome', 'bin/biome'), [
    'format',
    '--config-path',
    config.biome,
    '--',
    ...biomeFiles,
  ]);
  run('Biome lint', tool('@biomejs/biome', 'bin/biome'), [
    'lint',
    '--config-path',
    config.biome,
    '--',
    ...biomeFiles,
  ]);
}

if (astroFiles.length > 0) {
  run('Prettier', tool('prettier', 'bin/prettier.cjs'), [
    '--config',
    config.prettier,
    '--check',
    '--',
    ...astroFiles,
  ]);
  run('ESLint', tool('eslint', 'bin/eslint.js'), [
    '--config',
    config.eslint,
    '--max-warnings',
    '0',
    '--',
    ...astroFiles,
  ]);
}
