import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const authServiceSource = await readFile(
  new URL('../app/composables/useAuthService.ts', import.meta.url),
  'utf8',
);

const mobileAppSource = await readFile(
  new URL('../../mobile/App.tsx', import.meta.url),
  'utf8',
);

const extractFunctionBody = (source, functionName) => {
  const declarations = [
    `async function ${functionName}`,
    `const ${functionName} =`,
  ];
  const start = declarations
    .map(declaration => source.indexOf(declaration))
    .find(index => index !== -1);
  assert.notEqual(start, undefined, `${functionName} should exist`);

  const arrowBodyStart = source.indexOf('=> {', start);
  const functionBodyStart = source.indexOf(' {\n', start);
  const bodyStart = [arrowBodyStart, functionBodyStart]
    .filter(index => index !== -1)
    .map(index => source.indexOf('{', index))
    .sort((left, right) => left - right)[0];
  assert.notEqual(bodyStart, undefined, `${functionName} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(bodyStart, index + 1);
    }
  }

  assert.fail(`${functionName} body should close`);
};

test('auth initialize can refresh silently while explicit revalidate logs out on failure', () => {
  const fetchUserWithRefreshBody = extractFunctionBody(authServiceSource, 'fetchUserWithRefresh');
  const revalidateBody = extractFunctionBody(authServiceSource, 'revalidate');

  assert.match(
    fetchUserWithRefreshBody,
    /refreshToken\(\{\s*logoutOnFailure:\s*false\s*\}\)/,
    'shared fetch should avoid forced logout while probing for a recoverable session',
  );
  assert.match(
    fetchUserWithRefreshBody,
    /if\s*\(options\.logoutOnFailure\)\s*\{\s*await performLogout\(\)/s,
    'explicit callers should be able to clear cookies and server session on refresh failure',
  );
  assert.match(
    revalidateBody,
    /fetchUserWithRefresh\(\{\s*logoutOnFailure:\s*true\s*\}\)/,
    'explicit revalidation should opt into logout-on-failure behavior',
  );
});

test('mobile webview logs redact auth query secrets before printing URLs', () => {
  const redactionBody = extractFunctionBody(mobileAppSource, 'redactSensitiveUrl');

  assert.match(redactionBody, /SENSITIVE_QUERY_KEYS/);
  assert.match(redactionBody, /searchParams\.set\(key,\s*'\[redacted\]'\)/);
  assert.match(redactionBody, /signup_token/);
  assert.match(redactionBody, /code/);

  assert.match(mobileAppSource, /NavigationState:',\s*redactSensitiveUrl\(navState\.url\)/);
  assert.match(mobileAppSource, /ShouldStartLoad:',\s*redactSensitiveUrl\(url\)/);
  assert.match(mobileAppSource, /LoadEnd:',\s*redactSensitiveUrl\(nativeEvent\?\.url\)/);
  assert.match(mobileAppSource, /'url:',\s*redactSensitiveUrl\(nativeEvent\?\.url\)/);
  assert.doesNotMatch(mobileAppSource, /NavigationState:',\s*navState\.url/);
  assert.doesNotMatch(mobileAppSource, /ShouldStartLoad:',\s*url\)/);
  assert.doesNotMatch(mobileAppSource, /LoadEnd:',\s*nativeEvent\?\.url/);
});

test('mobile social login logs never print token-bearing response bodies', () => {
  const consoleLines = mobileAppSource
    .split('\n')
    .filter(line => /console\.(?:log|warn|error)\(/.test(line));

  for (const line of consoleLines) {
    assert.doesNotMatch(
      line,
      /JSON\.stringify\(data\)|data\.(?:access|refresh)\b/,
      'social login response bodies can include access or refresh tokens',
    );
  }

  assert.match(mobileAppSource, /\[Apple Login\] Response received/);
});
