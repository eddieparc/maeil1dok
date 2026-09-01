import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;

const importTsModule = async (source) => {
  const { code } = await transform(source, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const helperSource = await readFile(
  new URL('../app/utils/socialAuthError.ts', import.meta.url),
  'utf8',
);
const callbackSource = await readFile(
  new URL('../app/pages/auth/[provider]/callback.vue', import.meta.url),
  'utf8',
);
const { resolveSocialAuthError } = await importTsModule(helperSource);

test('OAuth callback errors preserve detail for web and native recovery', () => {
  const result = resolveSocialAuthError({
    data: {
      error: '소셜 로그인 제공자 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error_code: 'provider_temporarily_unavailable',
      action: 'retry',
      request_id: 'callback-request-1',
    },
  });

  assert.equal(result.errorCode, 'provider_temporarily_unavailable');
  assert.equal(result.action, 'retry');
  assert.match(result.message, /callback-request-1/);
  assert.equal(result.requestId, 'callback-request-1');
});

test('callback implementation no longer collapses provider errors to login_failed', () => {
  assert.equal(
    callbackSource.includes("{ error: 'login_failed' }"),
    false,
  );
  assert.match(callbackSource, /modal\.alert/);
  assert.match(callbackSource, /error_code:\s*authError\.errorCode/);
  assert.match(callbackSource, /request_id:\s*authError\.requestId/);
});
