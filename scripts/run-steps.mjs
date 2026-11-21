import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {{ label: string, argv: string[] }} Step
 * @typedef {(step: Step, cwd: string) => number | Promise<number>} StepRunner
 * @typedef {{ steps?: Step[], runner?: StepRunner, cwd?: string }} RunStepsInput
 */

export const VERIFY_STEPS = [
  { label: 'format', argv: ['pnpm', 'format:check'] },
  { label: 'lint', argv: ['pnpm', 'lint'] },
  { label: 'types', argv: ['pnpm', 'typecheck'] },
  { label: 'repository', argv: ['pnpm', 'check:repo'] },
  { label: 'unit', argv: ['pnpm', 'test:unit'] },
  { label: 'integration', argv: ['pnpm', 'test:integration'] },
];

export const HEALTH_STEPS = [
  ...VERIFY_STEPS,
  { label: 'build', argv: ['pnpm', 'build'] },
  { label: 'browser', argv: ['pnpm', 'test:e2e'] },
];

/** @param {string} cwd @param {string[]} argv */
function resolveLauncher(cwd, argv) {
  const command = argv[0] ?? 'pnpm';

  if (command !== 'pnpm') {
    return { command, args: argv.slice(1) };
  }

  const localPnpm = path.resolve(
    cwd,
    '.tools/pnpm/node_modules/pnpm/bin/pnpm.mjs',
  );

  if (fs.existsSync(localPnpm)) {
    return {
      command: process.execPath,
      args: [localPnpm, ...argv.slice(1)],
    };
  }

  return { command: 'pnpm', args: argv.slice(1) };
}

/** @param {Step} step @param {string} cwd */
function defaultRunner(step, cwd) {
  const { command, args } = resolveLauncher(cwd, step.argv);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`error: ${step.label}: ${result.error.message}`);
  }

  return result.status ?? 1;
}

/** @param {RunStepsInput} [input] */
export async function runSteps({
  steps = VERIFY_STEPS,
  runner = defaultRunner,
  cwd = process.cwd(),
} = {}) {
  for (const step of steps) {
    console.log(`→ ${step.label}`);
    const status = await runner(step, cwd);

    if (status !== 0) {
      console.error(`Failed step: ${step.label}`);
      return typeof status === 'number' && status > 0 ? status : 1;
    }
  }

  return 0;
}

async function main() {
  const mode = process.argv[2] ?? 'verify';

  if (mode !== 'verify' && mode !== 'health') {
    console.error('Unknown mode');
    process.exitCode = 2;
    return;
  }

  const status = await runSteps({
    steps: mode === 'health' ? HEALTH_STEPS : VERIFY_STEPS,
  });

  if (status !== 0) {
    process.exitCode = status;
  }
}

if (process.argv[1]?.endsWith('run-steps.mjs')) {
  await main();
}
