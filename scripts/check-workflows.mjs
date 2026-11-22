import fs from 'node:fs';
import path from 'node:path';
import { createLinter } from 'actionlint';

const root = process.cwd();
const workflowsDir = path.join(root, '.github', 'workflows');
const configuredVariables = new Set(['VERCEL_ORG_ID', 'VERCEL_PROJECT_ID']);

function prepareForLint(contents = '') {
  return contents.replace(
    /\bvars\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
    (match, name) => (configuredVariables.has(name) ? `env.${name}` : match),
  );
}

/** @type {string[]} */
let files = [];

try {
  files = fs
    .readdirSync(workflowsDir)
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .sort();
} catch {
  console.error('error: workflow directory unavailable');
  process.exitCode = 1;
}

if (files.length === 0 && process.exitCode !== 1) {
  console.error('error: no workflows found');
  process.exitCode = 1;
}

if (files.length > 0) {
  const lint = await createLinter();
  /** @type {string[]} */
  const findings = [];

  for (const file of files) {
    const absolute = path.join(workflowsDir, file);
    const contents = fs.readFileSync(absolute, 'utf8');
    const relative = path.relative(root, absolute).split(path.sep).join('/');

    for (const result of lint(prepareForLint(contents), relative)) {
      findings.push(
        `${relative}:${result.line}:${result.column}: ${result.message} (${result.kind})`,
      );
    }
  }

  for (const finding of findings) {
    console.error(`error: ${finding}`);
  }

  if (findings.length > 0) {
    process.exitCode = 1;
  } else {
    console.log('Workflow validation passed.');
  }
}
