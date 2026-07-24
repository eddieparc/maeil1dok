import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transform } from 'esbuild';

const routePath = new URL('../server/api/cron/hasena-summary.get.ts', import.meta.url);

const importCronHandler = async () => {
  const source = await readFile(routePath, 'utf8');
  const transformed = await transform(
    `const useRuntimeConfig = globalThis.__hasenaCronTest.useRuntimeConfig;
const defineEventHandler = globalThis.__hasenaCronTest.defineEventHandler;
const getHeader = globalThis.__hasenaCronTest.getHeader;
const getQuery = globalThis.__hasenaCronTest.getQuery;
const setResponseStatus = globalThis.__hasenaCronTest.setResponseStatus;
${source
  .replace(/import \{ useRuntimeConfig \} from '#imports';?\n/, '')
  .replace(/import \{ defineEventHandler, getHeader, getQuery, setResponseStatus \} from 'h3';?\n/, '')
  .replace('export default defineEventHandler', 'const exported = defineEventHandler')}
export default exported;
`,
    { format: 'esm', loader: 'ts' },
  );
  const dataUrl = `data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`;
  return import(dataUrl);
};

const makeEvent = (url = '/api/cron/hasena-summary') => ({
  node: {
    req: {
      headers: {
        authorization: 'Bearer cron-secret',
      },
      url,
    },
    res: {
      statusCode: 200,
    },
  },
  context: {},
});

const installNuxtStubs = () => {
  const previous = globalThis.__hasenaCronTest;

  globalThis.__hasenaCronTest = {
    useRuntimeConfig: () => ({
      cronSecret: 'cron-secret',
      hasenaCronSecret: 'backend-secret',
      hasenaPlaylistId: '',
      youtubeApiKey: '',
      geminiApiKey: '',
      public: {
        apiBase: 'https://api.maeil1dok.app',
      },
    }),
    defineEventHandler: (handler) => handler,
    getHeader: (event, name) => event.node.req.headers[name.toLowerCase()],
    getQuery: (event) => Object.fromEntries(
      new URL(event.node.req.url, 'https://maeil1dok.app').searchParams.entries(),
    ),
    setResponseStatus: (event, statusCode) => {
      event.node.res.statusCode = statusCode;
    },
  };

  return () => {
    globalThis.__hasenaCronTest = previous;
  };
};

test('automatic Hasena summary cron delegates service-date selection to the backend', async () => {
  const restoreNuxtStubs = installNuxtStubs();
  const { default: handler } = await importCronHandler();
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init) => {
    const href = String(url);
    calls.push({ href, init });

    if (href.startsWith('https://www.youtube.com/')) {
      throw new Error(`Unexpected YouTube fetch: ${href}`);
    }

    if (href === 'https://api.maeil1dok.app/api/v1/todos/hasena/summary/cron/') {
      return Response.json({
        success: true,
        video_id: 'VkWhiXwG-Fw',
      });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    const result = await handler(makeEvent());

    assert.equal(result.success, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].href, 'https://api.maeil1dok.app/api/v1/todos/hasena/summary/cron/');
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].init.body), {});
  } finally {
    globalThis.fetch = originalFetch;
    restoreNuxtStubs();
  }
});

test('explicit Hasena summary cron query forwards only supplied overrides', async () => {
  const restoreNuxtStubs = installNuxtStubs();
  const { default: handler } = await importCronHandler();
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init) => {
    const href = String(url);
    calls.push({ href, init });

    if (href === 'https://api.maeil1dok.app/api/v1/todos/hasena/summary/cron/') {
      return Response.json({
        success: true,
        video_id: 'VkWhiXwG-Fw',
      });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    const result = await handler(makeEvent(
      '/api/cron/hasena-summary?video_id=VkWhiXwG-Fw&video_date=2026-06-25&title=%ED%95%98%EC%84%B8%EB%82%98',
    ));

    assert.equal(result.success, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      video_id: 'VkWhiXwG-Fw',
      video_date: '2026-06-25',
      title: '하세나',
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreNuxtStubs();
  }
});
