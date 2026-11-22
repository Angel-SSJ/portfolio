import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('playwright deployment smoke configuration', () => {
  it('disables traces and screenshots during staged production smoke', async () => {
    vi.stubEnv('BASE_URL', 'https://staging.example.vercel.app');
    vi.stubEnv('PORTFOLIO_DEPLOY_HOST', 'staging.example.vercel.app');
    vi.stubEnv('PORTFOLIO_STAGED_SMOKE', '1');
    vi.resetModules();

    const module = await import('../../playwright.config.ts');
    const use = (module.default as { use?: Record<string, unknown> }).use;

    expect(use?.trace).toBe('off');
    expect(use?.screenshot).toBe('off');
  });

  it('runs browser projects serially to avoid local resource starvation', async () => {
    vi.stubEnv('BASE_URL', 'https://staging.example.vercel.app');
    vi.stubEnv('PORTFOLIO_DEPLOY_HOST', 'staging.example.vercel.app');
    vi.resetModules();

    const module = await import('../../playwright.config.ts');
    const workers = (module.default as { workers?: number }).workers;

    expect(workers).toBe(1);
  });

  it('supports an optional Vercel automation bypass header', async () => {
    vi.stubEnv('BASE_URL', 'https://staging.example.vercel.app');
    vi.stubEnv('PORTFOLIO_DEPLOY_HOST', 'staging.example.vercel.app');
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', 'bypass-value');
    vi.resetModules();

    const module = await import('../../playwright.config.ts');
    const use = (module.default as { use?: Record<string, unknown> }).use;

    expect(use?.extraHTTPHeaders).toEqual({
      'x-vercel-protection-bypass': 'bypass-value',
    });
  });
});
