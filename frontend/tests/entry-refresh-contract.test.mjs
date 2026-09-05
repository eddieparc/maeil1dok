import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { rawHexes, styleOf } from './helpers/design-contract.mjs';

// PR3 진입 — 로그인/회원가입 디자인 계약 (핸드오프 README "4. 로그인", "5. 회원가입").
const login = await readFile(new URL('../app/pages/login.vue', import.meta.url), 'utf8');
const register = await readFile(new URL('../app/pages/register-email.vue', import.meta.url), 'utf8');

test('소셜 버튼 3개는 52px 필 버튼이다', () => {
  const css = styleOf(login);
  assert.match(css, /height:\s*52px/, '소셜 버튼 높이 52px');
  assert.match(css, /border-radius:\s*(999px|var\(--radius-pill\))/, '필 반경');
  for (const token of ['--color-kakao-bg', '--color-apple-bg']) {
    assert.match(css, new RegExp(`var\\(${token}\\)`), `${token} 토큰 사용`);
  }
});

test('이메일 입력은 999px 이고 primary 는 두 필드 충족 전까지 비활성이다', () => {
  assert.match(styleOf(login), /input[^{]*\{[\s\S]*?border-radius:\s*(999px|var\(--radius-pill\))/, '입력 필 반경');
  assert.match(login, /:disabled="[^"]*(!|없|empty|isSubmitDisabled|canSubmit)/, 'primary disabled 조건 바인딩');
});

test('회원가입은 1/2 단계 표시와 진행 바를 가진다', () => {
  assert.match(register, /1\s*\/\s*2|currentStep|step\s*===/, '단계 표시');
  assert.match(styleOf(register), /(progress|step)[^{]*\{[\s\S]*?height:\s*3px/, '3px 진행 바');
  assert.match(styleOf(register), /var\(--color-accent-primary\)/, '진행 바 accent');
});

test('비밀번호 조건 체크가 노출된다', () => {
  for (const rule of ['8자 이상', '문자']) {
    assert.match(register, new RegExp(rule), `비밀번호 조건 ${rule}`);
  }
});

test('진입 화면에 원시 hex 와 이모지가 없다', () => {
  for (const [name, source] of [['login.vue', login], ['register-email.vue', register]]) {
    assert.deepEqual(rawHexes(source), [], `${name} 원시 hex`);
    assert.doesNotMatch(source, /\p{Extended_Pictographic}/u, `${name} 이모지`);
  }
});
