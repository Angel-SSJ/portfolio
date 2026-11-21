import { validateDeploymentBaseUrl } from './lib/deployment-url.mjs';
import { createReleaseServices } from './lib/releases.mjs';
import { HEALTH_STEPS, runSteps } from './run-steps.mjs';
import { verifyRelease } from './verify-release.mjs';

/**
 * @typedef {ReturnType<typeof createReleaseServices> & { health?: () => number | Promise<number> }} ReleaseServices
 * @typedef {{ cwd?: string, mode?: 'local' | 'tag', tagName?: string | null, services?: ReleaseServices, health?: (() => number | Promise<number>) | undefined }} CheckReleaseInput
 */

/**
 * @param {CheckReleaseInput} [input]
 */
export async function checkRelease(input = {}) {
  const cwd = input.cwd ?? process.cwd();
  const mode = input.mode ?? 'local';
  const tagName = input.tagName ?? null;
  /** @type {ReleaseServices} */
  const services = input.services ?? createReleaseServices(cwd);

  const configuredBaseUrl = process.env.BASE_URL;
  const deploymentBaseUrl =
    typeof configuredBaseUrl === 'string' &&
    /^https?:\/\//.test(configuredBaseUrl)
      ? configuredBaseUrl
      : null;

  try {
    validateDeploymentBaseUrl(deploymentBaseUrl, {
      deployHost: process.env.PORTFOLIO_DEPLOY_HOST,
    });
  } catch (error) {
    return {
      errors: [
        `invalid-base-url: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }

  const verified = await verifyRelease({ cwd, mode, tagName, services });

  if (verified.errors.length > 0) {
    return verified;
  }

  const health =
    input.health ??
    services.health ??
    (() => runSteps({ cwd, steps: HEALTH_STEPS }));
  const status = await health();

  if (status !== 0) {
    return { errors: ['health-failed'] };
  }

  return { errors: [] };
}

async function main() {
  const args = process.argv.slice(2);
  /** @type {'local' | 'tag'} */
  let mode = 'local';
  let tagName = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--tag') {
      tagName = args[index + 1] ?? null;
      index += 1;
    } else if (arg === '--local') {
      mode = 'local';
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exitCode = 2;
      return;
    }
  }

  if (tagName) {
    mode = 'tag';
  }

  try {
    const { errors } = await checkRelease({ mode, tagName });

    if (errors.length > 0) {
      for (const error of errors) {
        console.error(`error: ${error}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log(`Release checks passed (${mode}).`);
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('check-release.mjs')) {
  await main();
}
