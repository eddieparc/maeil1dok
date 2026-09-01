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

const source = await readFile(
  new URL('../app/utils/socialSignupError.ts', import.meta.url),
  'utf8',
);
const { resolveSocialSignupError } = await importTsModule(source);

test('detailed backend error keeps actionable message and request id', () => {
  const result = resolveSocialSignupError({
    status: 500,
    data: {
      error: '회원가입 서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error_code: 'signup_temporarily_unavailable',
      action: 'retry',
      request_id: 'request-500',
    },
  });

  assert.equal(result.action, 'retry');
  assert.match(result.message, /잠시 후 다시 시도/);
  assert.match(result.message, /request-500/);
});

test('expired signup sessions instruct a fresh social login', () => {
  const result = resolveSocialSignupError({
    data: {
      error: '가입 인증 시간이 만료되었습니다.',
      error_code: 'signup_session_expired',
      action: 'restart_social_login',
      request_id: 'request-expired',
    },
  });

  assert.equal(result.action, 'restart_social_login');
  assert.match(result.title, /인증 시간/);
  assert.match(result.message, /request-expired/);
});

test('nickname conflicts stay attached to the nickname field', () => {
  const result = resolveSocialSignupError({
    data: {
      error: '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.',
      error_code: 'nickname_taken',
      field: 'nickname',
      action: 'choose_another_nickname',
    },
  });

  assert.equal(result.action, 'choose_another_nickname');
  assert.equal(result.field, 'nickname');
  assert.match(result.message, /다른 닉네임/);
});

test('transport failures do not pretend the nickname or account is invalid', () => {
  const result = resolveSocialSignupError(new TypeError('Failed to fetch'));

  assert.equal(result.action, 'retry');
  assert.match(result.message, /네트워크/);
});
