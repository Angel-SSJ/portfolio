export function parseStagedDeployment(
  payload = {},
  expectedProjectId = '',
  expectedHost = '',
) {
  if (Reflect.get(payload, 'projectId') !== expectedProjectId) {
    throw new Error('unexpected project');
  }

  if (Reflect.get(payload, 'url') !== expectedHost) {
    throw new Error('unexpected deployment host');
  }

  if (Reflect.get(payload, 'target') !== 'production') {
    throw new Error('unexpected deployment target');
  }

  if (Reflect.get(payload, 'readyState') !== 'READY') {
    throw new Error('deployment not ready');
  }

  const id = Reflect.get(payload, 'id');

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('deployment id unavailable');
  }

  return { id, url: expectedHost };
}

async function main() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const stagedUrl = process.env.STAGED_URL;
  const orgId = process.env.VERCEL_ORG_ID;

  if (!token || !projectId || !stagedUrl) {
    console.error('Staged deployment verification is not configured.');
    process.exitCode = 2;
    return;
  }

  let host;

  try {
    host = new URL(stagedUrl).hostname;
  } catch {
    console.error('Staged deployment URL is invalid.');
    process.exitCode = 2;
    return;
  }

  const endpoint = new URL(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(host)}`,
  );

  if (orgId) {
    endpoint.searchParams.set('teamId', orgId);
  }

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    console.error(`Staged deployment inspection failed (${response.status}).`);
    process.exitCode = 1;
    return;
  }

  try {
    const result = parseStagedDeployment(
      await response.json(),
      projectId,
      host,
    );
    console.log(JSON.stringify(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`Staged deployment verification failed: ${message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('verify-staged-deployment.mjs')) {
  await main();
}
