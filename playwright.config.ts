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

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: isCI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
          command:
            'pnpm exec astro preview --host 127.0.0.1 --port 4321 --strictPort',
          url: LOCAL_READY_URL,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
      }),
});
