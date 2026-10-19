import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;
let importSequence = 0;

const apiSource = await readFile(
  new URL('../app/composables/useApi.ts', import.meta.url),
  'utf8',
);

const importApiModule = async () => {
  const runnableSource = apiSource
    .replace("import { readCsrfToken, storeCsrfToken } from './csrfCookie'",
      await readFile(new URL('../app/composables/csrfCookie.ts', import.meta.url), 'utf8'))
    .replace(
      "import { useRuntimeConfig } from '#app'",
      "const useRuntimeConfig = () => ({ public: { apiBase: 'http://api.test' }, internalApiBase: '' });",
    )
    .replace(
      "import { useAuthService } from '~/composables/useAuthService'",
      'const useAuthService = () => globalThis.__authDataReadinessAuth;',
    )
    .replace(
      "import { buildClientObservationHeaders } from '~/composables/clientObservationHeaders'",
      'const buildClientObservationHeaders = () => ({});',
    );

  const { code } = await transform(runnableSource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  importSequence += 1;
  return import(`${dataUrl}#${importSequence}`);
};

const importPlanApiModule = async () => {
  const source = await readFile(
    new URL('../app/composables/usePlanApi.ts', import.meta.url),
    'utf8',
  );
  const runnableSource = source
    .replace("import { ref } from 'vue';", 'const ref = value => ({ value });')
    .replace(
      "import { useApi } from '~/composables/useApi';",
      'const useApi = () => globalThis.__authDataReadinessApi;',
    )
    .replace(
      "import { useErrorHandler } from '~/composables/useErrorHandler';",
      'const useErrorHandler = () => ({ handleApiError(error) { throw error; } });',
    )
    .replace(
      "import { useToast } from '~/composables/useToast';",
      'const useToast = () => ({});',
    );
  const { code } = await transform(runnableSource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  importSequence += 1;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${importSequence}`);
};

const makeResponse = body => ({
  status: 200,
  ok: true,
  headers: { get: () => null },
  json: async () => body,
  clone() {
    return makeResponse(body);
  },
});

const createDeferredAuth = () => {
  let resolveInitialization;
  const initialization = new Promise(resolve => {
    resolveInitialization = resolve;
  });
  let initializationStarts = 0;

  const auth = {
    isAuthenticated: { value: false },
    isInitialized: { value: false },
    isLoading: { value: true },
    initialize: () => {
      if (initializationStarts === 0) initializationStarts += 1;
      return initialization;
    },
    refreshToken: async () => true,
    logout: () => {},
  };

  return {
    auth,
    initializationStarts: () => initializationStarts,
    resolveAsAuthenticated: () => {
      auth.isAuthenticated.value = true;
      auth.isInitialized.value = true;
      auth.isLoading.value = false;
      resolveInitialization();
    },
    resolveAsGuest: () => {
      auth.isInitialized.value = true;
      auth.isLoading.value = false;
      resolveInitialization();
    },
  };
};

const withEnvironment = async (auth, run, responseBody = { success: true, notifications: [] }) => {
  const saved = Object.fromEntries(
    ['window', 'document', 'localStorage', 'fetch'].map(key => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const fetchCalls = [];

  globalThis.window = {};
  globalThis.document = { cookie: '' };
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
  };
  globalThis.fetch = async (...args) => {
    fetchCalls.push(args);
    return makeResponse(responseBody);
  };
  globalThis.__authDataReadinessAuth = auth;

  try {
    return await run(fetchCalls);
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    delete globalThis.__authDataReadinessAuth;
    delete globalThis.__authDataReadinessApi;
  }
};

test('protected initial reads stay pending until auth resolves as authenticated', async () => {
  const deferredAuth = createDeferredAuth();
  const { useApi } = await importApiModule();
  const protectedPaths = [
    '/api/v1/todos/notifications/',
    '/api/v1/todos/plans/user/',
    '/api/v1/todos/plan/',
    '/api/v1/todos/bible/notes/',
    '/api/v1/todos/bible/bookmarks/',
    '/api/v1/todos/bible/highlights/',
    '/api/v1/todos/bible/personal-records/stats/',
    '/api/v1/todos/bible/reading-position/',
  ];

  await withEnvironment(deferredAuth.auth, async fetchCalls => {
    const api = useApi();
    let settled = false;

    const initialReads = Promise.all(protectedPaths.map(path => api.get(path))).finally(() => {
      settled = true;
    });
    await Promise.resolve();

    assert.equal(settled, false, 'the protected read must remain pending during auth restoration');
    assert.equal(fetchCalls.length, 0, 'data fetching must wait for restored identity');

    deferredAuth.resolveAsAuthenticated();
    const responses = await initialReads;

    assert.equal(responses.every(response => response.data.success), true);
    assert.equal(
      fetchCalls.length,
      protectedPaths.length,
      'authenticated data fetching starts after restoration',
    );
    assert.equal(deferredAuth.initializationStarts(), 1, 'auth restoration starts once');
  });
});

test('protected initial reads settle as guest only after auth restoration', async () => {
  const deferredAuth = createDeferredAuth();
  const { useApi } = await importApiModule();

  await withEnvironment(deferredAuth.auth, async fetchCalls => {
    const api = useApi();
    let settled = false;

    const firstRead = api.GET('/api/v1/todos/notifications/').finally(() => {
      settled = true;
    });
    await Promise.resolve();

    assert.equal(settled, false);
    deferredAuth.resolveAsGuest();

    const response = await firstRead;
    assert.equal(response.data.success, false);
    assert.equal(typeof response.data.message, 'string');
    assert.equal(fetchCalls.length, 0);
    assert.equal(deferredAuth.initializationStarts(), 1);
  });
});

for (const alreadyRestored of [false, true]) {
  test(`guest plan selector fetches public plans ${alreadyRestored ? 'with restored auth' : 'after auth restoration'}`, { timeout: 5000 }, async () => {
    const deferredAuth = createDeferredAuth();
    if (alreadyRestored) deferredAuth.resolveAsGuest();
    const [{ useApi }, { usePlanApi }] = await Promise.all([
      importApiModule(),
      importPlanApiModule(),
    ]);
    const publicPlans = [{ id: 7, plan: 7, plan_name: 'Public', is_active: true }];

    await withEnvironment(deferredAuth.auth, async fetchCalls => {
      globalThis.__authDataReadinessApi = useApi();
      const selector = usePlanApi();
      const initialRead = selector.fetchSubscriptions();

      if (!alreadyRestored) {
        assert.equal(deferredAuth.initializationStarts(), 1);
        assert.equal(fetchCalls.length, 0, 'the selector must wait for identity restoration');
        deferredAuth.resolveAsGuest();
      }
      const plans = await initialRead;

      assert.equal(fetchCalls.length, 1, 'a restored guest must request public plans over the network');
      assert.equal(fetchCalls[0][0], 'http://api.test/api/v1/todos/plan/');
      assert.equal(fetchCalls[0][1].method ?? 'GET', 'GET');
      assert.equal(fetchCalls[0][1].credentials, 'include');
      assert.deepEqual(plans, publicPlans);
      assert.equal(deferredAuth.auth.isAuthenticated.value, false);
      assert.equal(deferredAuth.initializationStarts(), alreadyRestored ? 0 : 1);
    }, publicPlans);
  });
}

for (const alreadyRestored of [false, true]) {
  test(`anonymous support POST reaches transport ${alreadyRestored ? 'after' : 'during'} auth restoration`, { timeout: 5000 }, async () => {
    const deferredAuth = createDeferredAuth();
    if (alreadyRestored) deferredAuth.resolveAsGuest();
    deferredAuth.auth.refreshToken = async () => assert.fail('public success must not refresh auth');
    const { useApi } = await importApiModule();
    const receipt = { receipt_id: '10ec28ec-a128-4444-9876-2bbc8a2b4a6a', status: 'received' };
    const payload = { kind: 'bug', message: 'Anonymous issue' };

    await withEnvironment(deferredAuth.auth, async fetchCalls => {
      assert.deepEqual(await useApi().POST('/api/v1/support/inquiries/', payload), receipt);
      assert.equal(fetchCalls.length, 1);
      assert.equal(fetchCalls[0][0], 'http://api.test/api/v1/support/inquiries/');
      assert.equal(fetchCalls[0][1].method, 'POST');
      assert.equal(fetchCalls[0][1].credentials, 'include');
      assert.deepEqual(JSON.parse(fetchCalls[0][1].body), payload);
      assert.equal(deferredAuth.initializationStarts(), 0);
      assert.equal(deferredAuth.auth.isAuthenticated.value, false);
    }, receipt);
  });
}

test('public support exception does not allow neighboring POST routes or protected mutation methods', async () => {
  const deferredAuth = createDeferredAuth();
  deferredAuth.resolveAsGuest();
  const { useApi } = await importApiModule();
  const supportPath = '/api/v1/support/inquiries/';

  await withEnvironment(deferredAuth.auth, async fetchCalls => {
    const api = useApi();
    for (const path of [
      '/api/v1/support/',
      `${supportPath}1/`,
      `/prefix${supportPath}`,
      '/api/v1/todos/hasena/record/update/',
      '/api/v1/admin/members/',
    ]) {
      await assert.rejects(api.post(path, {}), { name: 'ApiError', status: 401 });
    }
    for (const method of ['put', 'patch', 'delete']) {
      await assert.rejects(api[method](supportPath, {}), { name: 'ApiError', status: 401 });
    }
    await assert.rejects(api.upload(supportPath, new FormData()), { name: 'ApiError', status: 401 });
    assert.equal(fetchCalls.length, 0, 'protected mutations must still fail before transport');
    assert.equal(deferredAuth.initializationStarts(), 0);
  });
});

test('initialized auth reads immediately without restarting initialization', async () => {
  const auth = {
    isAuthenticated: { value: true },
    isInitialized: { value: true },
    isLoading: { value: false },
    initialize: () => {
      throw new Error('initialized auth must not restart');
    },
    refreshToken: async () => true,
    logout: () => {},
  };
  const { useApi } = await importApiModule();

  await withEnvironment(auth, async fetchCalls => {
    const response = await useApi().GET('/api/v1/todos/notifications/');

    assert.equal(response.data.success, true);
    assert.equal(fetchCalls.length, 1);
  });
});
