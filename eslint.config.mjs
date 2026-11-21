import eslintPluginAstro from 'eslint-plugin-astro';

export default [
  ...eslintPluginAstro.configs['flat/recommended'],
  ...eslintPluginAstro.configs['flat/jsx-a11y-recommended'],
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.astro/**',
      '.tools/**',
      '.vercel/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      'docs/files/**',
    ],
  },
];
