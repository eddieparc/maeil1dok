import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;

const errorLoggerSource = await readFile(
  new URL('../server/plugins/error-logger.ts', import.meta.url),
  'utf8',
);

const importErrorLoggerModule = async () => {
  globalThis.defineNitroPlugin = (fn) => fn;
  const { code } = await transform(errorLoggerSource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const authServiceSource = await readFile(
  new URL('../app/composables/useAuthService.ts', import.meta.url),
  'utf8',
);

const mobileAppSource = await readFile(
  new URL('../../mobile/App.tsx', import.meta.url),
  'utf8',
);

const mobileUrlRedactionSource = await readFile(
  new URL('../../mobile/urlRedaction.ts', import.meta.url),
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
  assert.match(mobileUrlRedactionSource, /const SENSITIVE_QUERY_KEYS = new Set/);
  assert.match(mobileUrlRedactionSource, /for\s*\(const key of parsedUrl\.searchParams\.keys\(\)\)/);
  assert.match(mobileUrlRedactionSource, /SENSITIVE_QUERY_KEYS\.has\(key\.toLowerCase\(\)\)/);
  assert.match(mobileUrlRedactionSource, /searchParams\.set\(key,\s*'\[redacted\]'\)/);
  for (const sensitiveKey of [
    'access',
    'code',
    'refresh',
    'signup_token',
    'token',
    'access_token',
    'refresh_token',
    'id_token',
  ]) {
    assert.match(mobileUrlRedactionSource, new RegExp(`['\"]${sensitiveKey}['\"]`));
  }

  assert.match(mobileAppSource, /import\s*\{\s*redactSensitiveUrl\s*\}\s*from\s*'\.\/urlRedaction';/);
  assert.doesNotMatch(
    mobileAppSource,
    /(?:const|let|var|function)\s+redactSensitiveUrl\b/,
    'App should use the shared redaction helper instead of declaring a local one',
  );
  assert.doesNotMatch(
    mobileAppSource,
    /\bSENSITIVE_QUERY_KEYS\b/,
    'App should not own the sensitive-key policy',
  );

  assert.match(mobileAppSource, /NavigationState:',\s*redactSensitiveUrl\(navState\.url\)/);
  assert.match(mobileAppSource, /ShouldStartLoad:',\s*redactSensitiveUrl\(url\)/);
  assert.match(mobileAppSource, /LoadEnd:',\s*redactSensitiveUrl\(nativeEvent\?\.url\)/);
  assert.match(mobileAppSource, /'url:',\s*redactSensitiveUrl\(nativeEvent\?\.url\)/);
  assert.match(mobileAppSource, /Opening YouTube app:',\s*redactSensitiveUrl\(url\)/);
  assert.doesNotMatch(mobileAppSource, /NavigationState:',\s*navState\.url/);
  assert.doesNotMatch(mobileAppSource, /ShouldStartLoad:',\s*url\)/);
  assert.doesNotMatch(mobileAppSource, /LoadEnd:',\s*nativeEvent\?\.url/);
  assert.doesNotMatch(mobileAppSource, /Opening YouTube app:',\s*url\)/);
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

test('nuxt SSR redactSensitiveUrl redacts sensitive query keys and keeps relative URLs relative', async () => {
  const { redactSensitiveUrl } = await importErrorLoggerModule();

  const relative = redactSensitiveUrl('/auth/kakao/setup?signup_token=secret&email=a@example.com&foo=bar');
  assert.ok(relative.startsWith('/auth/kakao/setup'), 'relative URL should stay relative');
  assert.doesNotMatch(relative, /secret/, 'signup_token value should be redacted');
  assert.doesNotMatch(relative, /a@example\.com/, 'email value should be redacted');
  assert.match(relative, /signup_token=%5Bredacted%5D|signup_token=\[redacted\]/);
  assert.match(relative, /foo=bar/, 'non-sensitive param should be preserved');
  assert.doesNotMatch(relative, /maeil1dok\.local/, 'no fabricated host should leak into relative URLs');

  const absolute = redactSensitiveUrl(
    'https://maeil1dok.app/callback?code=abc&state=xyz&token=t1&access=a1&refresh=r1&keep=1',
  );
  assert.match(absolute, /^https:\/\/maeil1dok\.app\/callback/, 'host/path preserved');
  for (const secret of ['abc', 'xyz', 't1', 'a1', 'r1']) {
    assert.doesNotMatch(absolute, new RegExp(`=${secret}(&|$)`), `${secret} should be redacted`);
  }
  assert.match(absolute, /keep=1/, 'non-sensitive param preserved');
});

test('nuxt SSR redactSensitiveUrl returns unknown for falsy input and survives malformed URLs', async () => {
  const { redactSensitiveUrl } = await importErrorLoggerModule();

  assert.equal(redactSensitiveUrl(''), 'unknown');
  assert.equal(redactSensitiveUrl(null), 'unknown');
  assert.equal(redactSensitiveUrl(undefined), 'unknown');

  const malformed = redactSensitiveUrl('http://[::1:bad?token=leak&safe=ok');
  assert.doesNotMatch(malformed, /token=leak/, 'regex fallback should redact malformed URL secrets');
  assert.match(malformed, /\[redacted\]/);
});

test('nuxt SSR redactSensitiveText redacts token-bearing URLs in error messages', async () => {
  const { redactSensitiveText } = await importErrorLoggerModule();

  const redacted = redactSensitiveText('boom at https://maeil1dok.app/verify?token=abc123');
  assert.doesNotMatch(redacted, /token=abc123/);
  assert.match(redacted, /\[redacted\]/);

  assert.equal(redactSensitiveText(null), '');
  assert.equal(redactSensitiveText(undefined), '');
});

test('nuxt SSR redactSensitiveUrl redacts token aliases and case variants', async () => {
  const { redactSensitiveUrl } = await importErrorLoggerModule();

  const aliased = redactSensitiveUrl(
    'https://maeil1dok.app/callback?access_token=AAA&refresh_token=BBB&id_token=CCC&keep=1',
  );
  for (const secret of ['AAA', 'BBB', 'CCC']) {
    assert.doesNotMatch(aliased, new RegExp(`=${secret}(&|$)`), `${secret} should be redacted`);
  }
  assert.match(aliased, /access_token=(?:%5Bredacted%5D|\[redacted\])/);
  assert.match(aliased, /refresh_token=(?:%5Bredacted%5D|\[redacted\])/);
  assert.match(aliased, /id_token=(?:%5Bredacted%5D|\[redacted\])/);
  assert.match(aliased, /keep=1/, 'non-sensitive param preserved');

  const mixedCase = redactSensitiveUrl(
    'https://maeil1dok.app/callback?ACCESS_TOKEN=AAA&refresh_TOKEN=BBB&ID_token=CCC&keep=1',
  );
  for (const secret of ['AAA', 'BBB', 'CCC']) {
    assert.doesNotMatch(mixedCase, new RegExp(`=${secret}(&|$)`), `case-variant ${secret} should be redacted`);
  }
  assert.match(mixedCase, /keep=1/, 'non-sensitive param preserved');
});

test('nuxt SSR redactSensitiveUrl redacts sensitive params inside hash fragments', async () => {
  const { redactSensitiveUrl } = await importErrorLoggerModule();

  const hashed = redactSensitiveUrl('https://maeil1dok.app/cb#access_token=HHH&id_token=III&safe=ok');
  assert.doesNotMatch(hashed, /access_token=HHH/, 'hash access_token should be redacted');
  assert.doesNotMatch(hashed, /id_token=III/, 'hash id_token should be redacted');
  assert.match(hashed, /access_token=(?:%5Bredacted%5D|\[redacted\])/);
  assert.match(hashed, /safe=ok/, 'non-sensitive hash param preserved');

  const relativeHash = redactSensitiveUrl('/auth/callback#refresh_token=RRR&keep=1');
  assert.ok(relativeHash.startsWith('/auth/callback'), 'relative URL should stay relative');
  assert.doesNotMatch(relativeHash, /refresh_token=RRR/, 'relative hash refresh_token should be redacted');
  assert.match(relativeHash, /keep=1/, 'non-sensitive hash param preserved');
});

test('nuxt SSR fallback redaction covers token aliases and case variants', async () => {
  const { redactSensitiveUrl, redactSensitiveText } = await importErrorLoggerModule();

  const malformed = redactSensitiveUrl('http://[::1:bad?access_token=leak&ID_token=leak2&safe=ok');
  assert.doesNotMatch(malformed, /access_token=leak/, 'fallback should redact alias secrets');
  assert.doesNotMatch(malformed, /ID_token=leak2/, 'fallback should redact case-variant alias secrets');
  assert.match(malformed, /\[redacted\]/);
  assert.match(malformed, /safe=ok/, 'non-sensitive param preserved in fallback');

  const text = redactSensitiveText('boom app://x?refresh_token=zzz;id_token=qqq');
  assert.doesNotMatch(text, /refresh_token=zzz/, 'error text alias should be redacted');
  assert.doesNotMatch(text, /id_token=qqq/, 'semicolon-delimited alias should be redacted');
  assert.match(text, /\[redacted\]/);
});

test('nuxt SSR error logger source never logs raw request URLs or unredacted errors', () => {
  assert.match(errorLoggerSource, /redactSensitiveUrl\(event\?\.node\?\.req\?\.url\)/);
  assert.match(errorLoggerSource, /redactSensitiveUrl\(url\)/);
  assert.match(errorLoggerSource, /redactSensitiveText\(error\?\.message\)/);
  assert.match(errorLoggerSource, /redactSensitiveText\(error\?\.stack\)/);
  assert.doesNotMatch(errorLoggerSource, /console\.error\('URL:',\s*event\?\.node\?\.req\?\.url/);
  assert.doesNotMatch(errorLoggerSource, /'\[SSR Request\] URL:',\s*url\b/);
  for (const alias of ['access_token', 'refresh_token', 'id_token']) {
    assert.match(errorLoggerSource, new RegExp(`'${alias}'`), `${alias} should be a sensitive log key`);
  }
  assert.match(errorLoggerSource, /key\.toLowerCase\(\)/, 'query key redaction should be case-insensitive');
  assert.match(errorLoggerSource, /parsed\.hash = redactSensitiveParameters\(parsed\.hash\)/, 'hash fragments should be redacted');
});
