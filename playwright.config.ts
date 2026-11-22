import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import {
  LOCAL_BASE_URL,
  LOCAL_READY_URL,
  validateDeploymentBaseUrl,
} from './scripts/lib/deployment-url.mjs';

const externalBaseUrl = validateDeploymentBaseUrl(process.env.BASE_URL, {
  deployHost: process.env.PORTFOLIO_DEPLOY_HOST,
});
const baseUrl = externalBaseUrl ?? LOCAL_BASE_URL;
const isCI = Boolean(process.env.CI);
const stagedSmoke = process.env.PORTFOLIO_STAGED_SMOKE === '1';
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const localPnpm = path.join(
  process.cwd(),
  '.tools',
  'pnpm',
  'node_modules',
  'pnpm',
  'bin',
  'pnpm.mjs',
);
const previewCommand = fs.existsSync(localPnpm)
  ? `"${process.execPath}" "${localPnpm}" exec astro preview --host 127.0.0.1 --port 4321 --strictPort`
  : 'pnpm exec astro preview --host 127.0.0.1 --port 4321 --strictPort';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: baseUrl,
    ...(stagedSmoke
      ? {
          trace: 'off' as const,
          screenshot: 'off' as const,
          video: 'off' as const,
        }
      : {
          trace: 'on-first-retry' as const,
          screenshot: 'only-on-failure' as const,
        }),
    ...(bypassSecret
      ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': bypassSecret } }
      : {}),
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        reducedMotion: 'reduce',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: previewCommand,
          url: LOCAL_READY_URL,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
      }),
});
