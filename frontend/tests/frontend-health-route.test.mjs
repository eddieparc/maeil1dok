import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transform } from 'esbuild';

const routePath = new URL('../server/api/health.get.ts', import.meta.url);

const importHealthHandler = async () => {
  const source = await readFile(routePath, 'utf8');
  const transformed = await transform(
    `const useRuntimeConfig = (...args) => globalThis.__healthRouteTest.useRuntimeConfig(...args);
const defineEventHandler = (handler) => globalThis.__healthRouteTest.defineEventHandler(handler);
const setResponseStatus = (...args) => globalThis.__healthRouteTest.setResponseStatus(...args);
${source
  .replace(/import \{ useRuntimeConfig \} from '#imports';?\n/, '')
  .replace(/import \{ defineEventHandler, setResponseStatus \} from 'h3';?\n/, '')
  .replace('export default defineEventHandler', 'const exported = defineEventHandler')}
export default exported;
`,
    { format: 'esm', loader: 'ts' },
  );
  const dataUrl = `data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`;
  return import(dataUrl);
};

const makeEvent = () => ({
  node: {
    req: { url: '/api/health', headers: {} },
    res: { statusCode: 200 },
  },
  context: {},
});

const installNuxtStubs = ({ apiBase, internalApiBase } = {}) => {
  const previous = globalThis.__healthRouteTest;

  globalThis.__healthRouteTest = {
    useRuntimeConfig: () => ({
      internalApiBase: internalApiBase ?? '',
      public: {
        apiBase,
      },
    }),
    defineEventHandler: (handler) => handler,
    setResponseStatus: (event, statusCode) => {
      event.node.res.statusCode = statusCode;
    },
  };

  return () => {
    globalThis.__healthRouteTest = previous;
  };
};

const withEnv = async (nodeEnv, fn) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
};

// Recursively collect every string value in the returned payload so leak
// assertions cannot be fooled by nesting.
const collectStrings = (value, acc = []) => {
  if (typeof value === 'string') {
    acc.push(value);
  } else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectStrings(nested, acc);
    }
  }
  return acc;
};

const runHealth = async ({ nodeEnv, apiBase, internalApiBase }) => {
  const restore = installNuxtStubs({ apiBase, internalApiBase });
  try {
    const { default: handler } = await importHealthHandler();
    const event = makeEvent();
    const result = await withEnv(nodeEnv, () => handler(event));
    return { result, statusCode: event.node.res.statusCode };
  } finally {
    restore();
  }
};

test('production valid non-local HTTPS origin stays healthy', async () => {
  const { result, statusCode } = await runHealth({
    nodeEnv: 'production',
    apiBase: 'https://api.maeil1dok.app',
  });

  assert.equal(statusCode, 200);
  assert.equal(result.status, 'ok');
  assert.equal(result.service, 'maeil1dok-nuxt');
  assert.equal(result.checks.runtime.status, 'ok');
  assert.equal(result.checks.api_base.status, 'ok');
  assert.equal(result.checks.api_base.configured, true);
  assert.equal(result.checks.api_base.public_origin, 'https://api.maeil1dok.app');
});

test('production localhost public API base degrades to 503', async () => {
  const { result, statusCode } = await runHealth({
    nodeEnv: 'production',
    apiBase: 'http://localhost:8019',
  });

  assert.equal(statusCode, 503);
  assert.equal(result.status, 'degraded');
  assert.equal(result.checks.api_base.status, 'error');
  assert.equal(result.checks.api_base.reason, 'local_or_loopback');
});

test('production loopback hosts degrade to 503', async () => {
  const loopbacks = [
    'http://127.0.0.1:8019',
    'http://127.12.0.1:8019',
    'http://0.0.0.0:8019',
    'http://[::1]:8019',
  ];

  for (const apiBase of loopbacks) {
    const { result, statusCode } = await runHealth({ nodeEnv: 'production', apiBase });
    assert.equal(statusCode, 503, `expected 503 for ${apiBase}`);
    assert.equal(result.status, 'degraded', `expected degraded for ${apiBase}`);
    assert.equal(result.checks.api_base.reason, 'local_or_loopback', `reason for ${apiBase}`);
  }
});

test('production blank public API base degrades to 503', async () => {
  const { result, statusCode } = await runHealth({
    nodeEnv: 'production',
    apiBase: '   ',
  });

  assert.equal(statusCode, 503);
  assert.equal(result.status, 'degraded');
  assert.equal(result.checks.api_base.configured, false);
  assert.equal(result.checks.api_base.reason, 'blank');
});

test('production malformed public API base degrades to 503', async () => {
  const { result, statusCode } = await runHealth({
    nodeEnv: 'production',
    apiBase: 'https://:::not a url',
  });

  assert.equal(statusCode, 503);
  assert.equal(result.status, 'degraded');
  assert.equal(result.checks.api_base.reason, 'malformed');
});

test('production unsupported protocol degrades to 503', async () => {
  const { result, statusCode } = await runHealth({
    nodeEnv: 'production',
    apiBase: 'ftp://api.maeil1dok.app',
  });

  assert.equal(statusCode, 503);
  assert.equal(result.status, 'degraded');
  assert.equal(result.checks.api_base.reason, 'unsupported_protocol');
});

test('production non-origin values with credentials/path/query/fragment degrade to 503 without leaking', async () => {
  const nonOrigins = [
    'https://user:secret@api.maeil1dok.app',
    'https://api.maeil1dok.app/api/v1',
    'https://api.maeil1dok.app/?token=abc123',
    'https://api.maeil1dok.app/#fragment-secret',
  ];

  for (const apiBase of nonOrigins) {
    const { result, statusCode } = await runHealth({ nodeEnv: 'production', apiBase });
    assert.equal(statusCode, 503, `expected 503 for ${apiBase}`);
    assert.equal(result.status, 'degraded', `expected degraded for ${apiBase}`);
    assert.equal(result.checks.api_base.reason, 'non_origin', `reason for ${apiBase}`);

    const emitted = collectStrings(result);
    for (const leak of ['secret', 'token=abc123', 'fragment-secret', '/api/v1']) {
      for (const value of emitted) {
        assert.ok(!value.includes(leak), `payload leaked "${leak}" for ${apiBase}`);
      }
    }
  }
});

test('development localhost stays HTTP 200 with warning', async () => {
  const { result, statusCode } = await runHealth({
    nodeEnv: 'development',
    apiBase: 'http://localhost:8019',
  });

  assert.equal(statusCode, 200);
  assert.equal(result.status, 'ok');
  assert.equal(result.checks.api_base.status, 'warning');
  assert.equal(result.checks.api_base.reason, 'local_or_loopback');
});

test('absent internalApiBase is warning-only and does not degrade valid public base', async () => {
  const { result, statusCode } = await runHealth({
    nodeEnv: 'production',
    apiBase: 'https://api.maeil1dok.app',
    internalApiBase: '',
  });

  assert.equal(statusCode, 200);
  assert.equal(result.status, 'ok');
  assert.equal(result.checks.internal_api_base.status, 'warning');
  assert.equal(result.checks.internal_api_base.configured, false);
});

test('configured internalApiBase reports ok without exposing its value', async () => {
  const secretInternal = 'http://backend.railway.internal:8000';
  const { result } = await runHealth({
    nodeEnv: 'production',
    apiBase: 'https://api.maeil1dok.app',
    internalApiBase: secretInternal,
  });

  assert.equal(result.checks.internal_api_base.status, 'ok');
  assert.equal(result.checks.internal_api_base.configured, true);
  assert.equal(result.checks.internal_api_base.public_origin, undefined);

  for (const value of collectStrings(result)) {
    assert.ok(!value.includes('backend.railway.internal'), 'internal API base value leaked');
  }
});

test('payload exposes only sanitized fields', async () => {
  const { result } = await runHealth({
    nodeEnv: 'production',
    apiBase: 'https://api.maeil1dok.app',
    internalApiBase: 'http://backend.railway.internal:8000',
  });

  assert.deepEqual(Object.keys(result).sort(), ['checks', 'service', 'status']);
  assert.deepEqual(
    Object.keys(result.checks).sort(),
    ['api_base', 'internal_api_base', 'runtime'],
  );
  assert.deepEqual(
    Object.keys(result.checks.api_base).sort(),
    ['configured', 'public_origin', 'status'],
  );
  assert.deepEqual(
    Object.keys(result.checks.internal_api_base).sort(),
    ['configured', 'status'],
  );
});
