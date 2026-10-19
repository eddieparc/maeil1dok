import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transform } from 'esbuild';

const source = await readFile(new URL('../app/composables/useApi.ts', import.meta.url), 'utf8');
const { code } = await transform(source
  .replace("import { useRuntimeConfig } from '#app'", "const useRuntimeConfig = () => ({ public: { apiBase: 'https://api.test' } });")
  .replace("import { readCsrfToken, storeCsrfToken } from './csrfCookie'", 'const readCsrfToken = () => null; const storeCsrfToken = () => {};')
  .replace("import { useAuthService } from '~/composables/useAuthService'", 'const useAuthService = () => globalThis.transportAuth;')
  .replace("import { buildClientObservationHeaders } from '~/composables/clientObservationHeaders'", 'const buildClientObservationHeaders = () => ({});'),
{ loader: 'ts', format: 'esm' });
const { useApi } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

function environment(t, outcomes) {
  let calls = 0;
  let refreshes = 0;
  let logouts = 0;
  const auth = {
    isInitialized: { value: true }, isLoading: { value: false },
    isAuthenticated: { value: true },
    refreshToken: async (options) => {
      assert.deepEqual(options, { logoutOnFailure: false });
      refreshes++;
      return { ok: true };
    },
    logout: () => { logouts++; auth.isAuthenticated.value = false; },
  };
  t.mock.method(globalThis, 'fetch', async () => {
    const outcome = outcomes[calls++];
    if (outcome instanceof Error) throw outcome;
    assert.ok(outcome instanceof Response);
    return outcome;
  });
  globalThis.transportAuth = auth;
  t.after(() => { delete globalThis.transportAuth; });
  return { api: useApi(), observations: () => ({ calls, refreshes, logouts, authenticated: auth.isAuthenticated.value }) };
}

for (const message of ['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'fetch failed']) {
  for (const retry of [false, true]) {
    test(`classifies transport failure when ${message} rejects ${retry ? 'after refresh' : 'initially'}`, async (t) => {
      // Given
      const failure = new TypeError(message);
      const { api, observations } = environment(t, [...(retry ? [new Response(null, { status: 401 })] : []), failure]);
      // When
      await assert.rejects(api.get('/api/v1/todos/groups/'), (error) => {
        // Then: machine-readable interface, not pinned translated prose.
        assert.equal(error.name, 'ApiError');
        assert.equal(error.status, 0);
        assert.equal(error.data.code, 'NETWORK_ERROR');
        assert.equal(error.data.error, error.message);
        assert.equal(error.cause, failure);
        return true;
      });
      assert.deepEqual(observations(), { calls: retry ? 2 : 1, refreshes: retry ? 1 : 0, logouts: 0, authenticated: true });
    });
  }
}

for (const failure of [new DOMException('cancelled', 'AbortError'), new TypeError('Invalid URL'), new Error('programming failure')]) {
  for (const retry of [false, true]) {
    test(`preserves exception identity when ${failure.name}: ${failure.message} occurs ${retry ? 'after refresh' : 'initially'}`, async (t) => {
      // Given
      const { api, observations } = environment(t, [...(retry ? [new Response(null, { status: 401 })] : []), failure]);
      // When / Then
      await assert.rejects(api.get('/api/v1/todos/groups/'), (error) => error === failure);
      assert.equal(observations().calls, retry ? 2 : 1);
      assert.equal(observations().logouts, 0);
    });
  }
}

for (const status of [403, 429, 500]) {
  test(`preserves HTTP classification when server returns ${status}`, async (t) => {
    // Given
    const body = { detail: 'server detail' };
    const { api, observations } = environment(t, [Response.json(body, { status })]);
    // When / Then
    await assert.rejects(api.get('/api/v1/todos/groups/'), (error) => {
      assert.equal(error.status, status);
      assert.deepEqual(error.data, body);
      if (status !== 429) assert.equal(error.message, body.detail);
      return true;
    });
    assert.equal(observations().calls, 1);
  });
}

test('returns response when refresh and retry succeed', async (t) => {
  // Given
  const { api, observations } = environment(t, [new Response(null, { status: 401 }), Response.json({ success: true })]);
  // When
  const result = await api.get('/api/v1/todos/groups/');
  // Then
  assert.deepEqual(result, { data: { success: true } });
  assert.deepEqual(observations(), { calls: 2, refreshes: 1, logouts: 0, authenticated: true });
});

test('preserves decoding failures when a successful response has invalid JSON', async (t) => {
  // Given
  const { api } = environment(t, [new Response('invalid json')]);
  // When / Then
  await assert.rejects(api.get('/api/v1/todos/groups/'), SyntaxError);
});
