export const LOCAL_BASE_URL = 'http://127.0.0.1:4321';
export const LOCAL_READY_URL = `${LOCAL_BASE_URL}/index.html`;

/**
 * @param {string | null | undefined} baseUrl
 * @param {{ deployHost?: string | null | undefined }} [options]
 * @returns {string | null}
 */
export function validateDeploymentBaseUrl(baseUrl, { deployHost } = {}) {
  if (!baseUrl) {
    return null;
  }

  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('BASE_URL must be a valid absolute URL');
  }

  const hostMatches = deployHost
    ? url.hostname === deployHost
    : /(^|\.)vercel\.app$/.test(url.hostname);
  const hasCredentials = url.username !== '' || url.password !== '';

  if (url.protocol !== 'https:' || !hostMatches || hasCredentials) {
    throw new Error(
      'BASE_URL must be an allowed HTTPS deployment URL without credentials',
    );
  }

  return url.toString().replace(/\/+$/, '');
}
