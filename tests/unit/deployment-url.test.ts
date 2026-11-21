import { describe, expect, it } from 'vitest';
import { validateDeploymentBaseUrl } from '../../scripts/lib/deployment-url.mjs';

describe('deployment base URL validation', () => {
  it('accepts an explicit Vercel deployment URL', () => {
    expect(validateDeploymentBaseUrl('https://portfolio-abc.vercel.app/')).toBe(
      'https://portfolio-abc.vercel.app',
    );
  });

  it('accepts an explicitly configured host', () => {
    expect(
      validateDeploymentBaseUrl('https://portfolio.example.com', {
        deployHost: 'portfolio.example.com',
      }),
    ).toBe('https://portfolio.example.com');
  });

  it('rejects malformed, insecure, unapproved and credentialed URLs', () => {
    expect(() => validateDeploymentBaseUrl('not-a-url')).toThrow();
    expect(() => validateDeploymentBaseUrl('http://localhost:4321')).toThrow();
    expect(() => validateDeploymentBaseUrl('https://example.com')).toThrow();
    expect(() =>
      validateDeploymentBaseUrl('https://user:pass@portfolio.vercel.app'),
    ).toThrow();
  });
});
