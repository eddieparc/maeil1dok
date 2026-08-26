import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;

const errorLoggerSource = await readFile(
  new URL('../server/plugins/error-logger.ts', import.meta.url),
  'utf8',
);

const importTsModule = async (source) => {
  const { code } = await transform(source, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const importErrorLoggerModule = async () => {
  globalThis.defineNitroPlugin = (fn) => fn;
  return importTsModule(errorLoggerSource);
};

const authSessionPolicySource = await readFile(
  new URL('../app/composables/authSessionPolicy.ts', import.meta.url),
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

test('auth initialize can refresh silently while explicit revalidate logs out on failure', async () => {
  const {
    fetchUserWithRefreshPolicy,
    revalidateAuthSession,
  } = await importTsModule(authSessionPolicySource);

  const refreshOptions = [];
  let fetchCount = 0;
  let logoutCount = 0;
  const recoveredUser = { id: 7, nickname: '회복된 사용자' };
  const recovered = await fetchUserWithRefreshPolicy({
    fetchUser: async () => (++fetchCount === 1 ? null : recoveredUser),
    refreshToken: async options => {
      refreshOptions.push(options);
      return true;
    },
    logout: async () => {
      logoutCount += 1;
    },
  });

  assert.deepEqual(recovered, recoveredUser);
  assert.deepEqual(refreshOptions, [{ logoutOnFailure: false }]);
  assert.equal(logoutCount, 0, 'a recoverable session probe must not log the user out');

  const failedDependencies = {
    fetchUser: async () => null,
    refreshToken: async options => {
      refreshOptions.push(options);
      return false;
    },
    logout: async () => {
      logoutCount += 1;
    },
  };

  await fetchUserWithRefreshPolicy(failedDependencies);
  assert.equal(logoutCount, 0, 'silent initialization failure must preserve the server session');

  await fetchUserWithRefreshPolicy(failedDependencies, { logoutOnFailure: true });
  assert.equal(logoutCount, 1, 'an explicit failure policy must perform logout');

  await revalidateAuthSession(failedDependencies);
  assert.equal(logoutCount, 2, 'explicit revalidation must force logout after refresh rejection');
  assert.deepEqual(refreshOptions.slice(1), [
    { logoutOnFailure: false },
    { logoutOnFailure: false },
    { logoutOnFailure: false },
  ]);
});

test('mobile webview logs redact auth query secrets before printing URLs', async () => {
  const { redactSensitiveUrl } = await importTsModule(mobileUrlRedactionSource);
  const sensitiveKeys = [
    'access',
    'code',
    'refresh',
    'signup_token',
    'token',
    'access_token',
    'refresh_token',
    'id_token',
  ];
  const inputUrl = new URL('https://maeil1dok.app/auth/callback');
  for (const [index, sensitiveKey] of sensitiveKeys.entries()) {
    const key = index % 2 === 0 ? sensitiveKey.toUpperCase() : sensitiveKey;
    inputUrl.searchParams.set(key, `secret-${index}`);
  }
  inputUrl.searchParams.set('safe', 'keep-me');

  const redactedUrl = new URL(redactSensitiveUrl(inputUrl.toString()));
  for (const [index, sensitiveKey] of sensitiveKeys.entries()) {
    const key = index % 2 === 0 ? sensitiveKey.toUpperCase() : sensitiveKey;
    assert.equal(redactedUrl.searchParams.get(key), '[redacted]', `${key} must be redacted`);
  }
  assert.equal(redactedUrl.searchParams.get('safe'), 'keep-me');

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
});
