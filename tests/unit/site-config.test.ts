import { describe, expect, it } from 'vitest';
import { SiteConfigSchema } from '@/config/site';

describe('SiteConfigSchema', () => {
  it('accepts non-empty metadata without a site URL', () => {
    const result = SiteConfigSchema.safeParse({
      name: 'Angel Ramirez',
      description: 'Portafolio personal',
      lang: 'es',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(
      SiteConfigSchema.safeParse({ name: '', description: 'x', lang: 'es' }).success,
    ).toBe(false);
  });

  it('rejects a non-HTTP site URL', () => {
    expect(
      SiteConfigSchema.safeParse({
        name: 'Angel Ramirez',
        description: 'x',
        lang: 'es',
        siteUrl: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
  });

  it('rejects a malformed site URL', () => {
    expect(
      SiteConfigSchema.safeParse({
        name: 'Angel Ramirez',
        description: 'x',
        lang: 'es',
        siteUrl: 'not a url',
      }).success,
    ).toBe(false);
  });

  it('accepts an HTTPS site URL', () => {
    expect(
      SiteConfigSchema.safeParse({
        name: 'Angel Ramirez',
        description: 'x',
        lang: 'es',
        siteUrl: 'https://example.com',
      }).success,
    ).toBe(true);
  });
});
