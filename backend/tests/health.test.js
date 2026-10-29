const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.NODE_ENV = 'production';
process.env.FRONTEND_ORIGINS = 'http://localhost:8443';

const app = require('../src/app');

test('API health, readiness, errors, and CORS', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.on('listening', resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthResponse.status, 200);

    const readyResponse = await fetch(`${baseUrl}/api/ready`);
    assert.equal(readyResponse.status, 503);

    const missingResponse = await fetch(`${baseUrl}/unknown`);
    assert.equal(missingResponse.status, 404);
    assert.equal((await missingResponse.json()).message, 'Route not found.');

    const invalidJsonResponse = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(invalidJsonResponse.status, 400);
    assert.equal((await invalidJsonResponse.json()).message, 'Invalid request JSON.');

    const allowedOriginResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://localhost:8443' },
    });
    assert.equal(
      allowedOriginResponse.headers.get('access-control-allow-origin'),
      'http://localhost:8443',
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
