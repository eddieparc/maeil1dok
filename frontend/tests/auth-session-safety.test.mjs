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

test('a refresh that could not reach the server must not log the user out', async () => {
  const {
    fetchUserWithRefreshPolicy,
    revalidateAuthSession,
  } = await importTsModule(authSessionPolicySource);

  // A boolean cannot distinguish "the server rejected this refresh" from "the
  // request never arrived". Collapsing them means a subway tunnel reads as a
  // revoked session and the user is signed out for being offline. The refresh
  // outcome therefore carries a reason, and only a rejection may force logout.
  let logoutCount = 0;
  let unreachableCount = 0;
  const unreachableDependencies = {
    fetchUser: async () => null,
    refreshToken: async () => ({ ok: false, reason: 'unreachable' }),
    logout: async () => {
      logoutCount += 1;
    },
    onUnreachable: () => {
      unreachableCount += 1;
    },
  };

  const offlineResult = await revalidateAuthSession(unreachableDependencies);
  assert.equal(offlineResult, null, 'an unreachable refresh yields no user');
  assert.equal(
    logoutCount,
    0,
    'a transport failure must never log the user out',
  );
  assert.equal(
    unreachableCount,
    1,
    'the caller must be told the session state is unknown, not unauthenticated',
  );

  // The 401 path must still sign the user out, otherwise a genuinely revoked
  // session would linger.
  let rejectedLogoutCount = 0;
  const rejectedDependencies = {
    fetchUser: async () => null,
    refreshToken: async () => ({ ok: false, reason: 'rejected' }),
    logout: async () => {
      rejectedLogoutCount += 1;
    },
  };

  await revalidateAuthSession(rejectedDependencies);
  assert.equal(
    rejectedLogoutCount,
    1,
    'a rejected refresh must still force logout',
  );

  // Silent initialization keeps its existing contract: no logout either way.
  let silentLogoutCount = 0;
  await fetchUserWithRefreshPolicy({
    fetchUser: async () => null,
    refreshToken: async () => ({ ok: false, reason: 'rejected' }),
    logout: async () => {
      silentLogoutCount += 1;
    },
  });
  assert.equal(
    silentLogoutCount,
    0,
    'silent initialization must not log out on rejection',
  );

  // A plain boolean still works: existing callers are unchanged.
  let legacyLogoutCount = 0;
  await revalidateAuthSession({
    fetchUser: async () => null,
    refreshToken: async () => false,
    logout: async () => {
      legacyLogoutCount += 1;
    },
  });
  assert.equal(
    legacyLogoutCount,
    1,
    'a boolean false keeps its rejection semantics',
  );
});

test('a reasoned refresh outcome is never read as a bare truthy value', async () => {
  // `refreshToken()` returns an object now. Every call site that used it as a
  // boolean must unwrap `.ok`, because `{ ok: false }` is truthy and would make a
  // failed refresh look like a success -- retrying the request with credentials
  // that were just refused.
  const useApiSource = await readFile(
    new URL('../app/composables/useApi.ts', import.meta.url),
    'utf8',
  );
  const authServiceSource = await readFile(
    new URL('../app/composables/useAuthService.ts', import.meta.url),
    'utf8',
  );

  const truthyMisread = /const\s+(\w+)\s*=\s*await\s+auth\.refreshToken\(\)\s*\n\s*\n?\s*if\s*\(\1\)/;
  assert.ok(
    !truthyMisread.test(useApiSource),
    'useApi must unwrap the refresh outcome instead of testing the object itself',
  );

  // The neutral state must be its own thing: folding it into `unauthenticated`
  // reintroduces the logout-on-offline bug, and folding it into `loading` would
  // spin forever instead of offering a retry.
  assert.match(
    authServiceSource,
    /'unknown-offline'/,
    'the auth state machine must carry an unknown-offline state',
  );
  assert.match(
    authServiceSource,
    /isSessionUnknown:\s*computed\(\(\)\s*=>\s*_authState\.value === 'unknown-offline'\)/,
    'callers need a derived flag for the unknown state',
  );
  assert.match(
    authServiceSource,
    /isAuthenticated:\s*computed\(\(\)\s*=>\s*_authState\.value === 'authenticated'\)/,
    'unknown-offline must not count as authenticated',
  );
});

test('transport failures, rejections and CSRF failures are three different answers', async () => {
  // Rewritten 2026-08-30. The previous version scanned the source of
  // `refreshToken` and REQUIRED the literal
  // `result.status === 401 || result.status === 403 ... reason: 'rejected'`.
  //
  // That line is the defect. It signed a user out at 10:00 KST on 2026-08-30 —
  // the production log holds `refresh_401 403 cause=csrf` followed immediately by
  // a logout call. The assertion was pinning the bug in place, the same shape as
  // a golden that approves a 500 as expected.
  //
  // Asserted through the policy now, so the mapping is judged by behaviour rather
  // than by where the branch happens to live.
  const { refreshWithCsrfRecovery } = await importTsModule(authSessionPolicySource);

  const spy = (statuses, recovered = 'fresh') => {
    const calls = { logouts: 0, attempts: 0 };
    return {
      calls,
      deps: {
        attempt: async () => statuses[Math.min(calls.attempts++, statuses.length - 1)],
        recoverCsrfToken: async () => recovered,
        logout: async () => {
          calls.logouts += 1;
        },
      },
    };
  };

  const offline = spy([{ status: 0, ok: false }]);
  assert.deepEqual(
    await refreshWithCsrfRecovery(offline.deps, {}),
    { ok: false, reason: 'unreachable' },
    'a status-0 result must map to unreachable',
  );
  assert.equal(offline.calls.logouts, 0);

  const refused = spy([{ status: 401, ok: false }]);
  assert.deepEqual(
    await refreshWithCsrfRecovery(refused.deps, {}),
    { ok: false, reason: 'rejected' },
    'a 401 must map to rejected',
  );
  assert.equal(refused.calls.logouts, 1, 'a refused identity still ends the session');

  const csrf = spy([{ status: 403, ok: false }]);
  assert.deepEqual(
    await refreshWithCsrfRecovery(csrf.deps, {}),
    { ok: false, reason: 'unreachable' },
    'a 403 says nothing about the session and must not be read as a rejection',
  );
  assert.equal(csrf.calls.logouts, 0, 'a CSRF failure must never sign the user out');
});

test('the unknown-session surface is neutral, global, and offers a retry', async () => {
  // The state exists but nothing renders it yet. Without a surface the user sees
  // a page that silently refuses to work: `isAuthenticated` is false so
  // auth-gated UI hides, and no explanation appears anywhere.
  //
  // It has to be ONE global surface. Branching on `isSessionUnknown` inside each
  // of the 8+ components that read `isAuthenticated` guarantees one gets missed,
  // and `app.vue` already hosts EmailVerificationBanner for exactly this shape.
  const bannerSource = await readFile(
    new URL('../app/components/auth/SessionUnknownBanner.vue', import.meta.url),
    'utf8',
  );
  const appSource = await readFile(
    new URL('../app/app.vue', import.meta.url),
    'utf8',
  );

  assert.match(
    appSource,
    /<SessionUnknownBanner\s*\/>/,
    'app.vue must host the banner globally',
  );
  assert.match(
    appSource,
    /import SessionUnknownBanner from '~\/components\/auth\/SessionUnknownBanner\.vue'/,
    'app.vue must import the banner',
  );

  // Machine-consumed contract, not prose: the banner keys off the derived flag
  // and exposes a retry hook plus a sign-in escape hatch.
  assert.match(
    bannerSource,
    /isSessionUnknown/,
    'the banner must be driven by the derived unknown-session flag',
  );
  assert.match(
    bannerSource,
    /data-testid="session-unknown-retry"/,
    'the retry control needs a stable hook for QA and e2e',
  );
  assert.match(
    bannerSource,
    /data-testid="session-unknown-signin"/,
    'the user must still be able to sign in manually from this surface',
  );

  // The retry must actually re-ask the server, not just hide the banner.
  assert.match(
    bannerSource,
    /revalidate|refreshUser|initialize/,
    'retry must re-verify the session rather than dismissing the notice',
  );
});

test('both policy call sites report an unreachable session', async () => {
  // Two call sites feed the policy: the silent init path and the explicit
  // revalidate path. Wiring only one leaves a hole -- the banner never appears on
  // the unwired path, and a failed retry from the banner would make it vanish as
  // if the problem were solved. This was actually missed once.
  const authServiceSource = await readFile(
    new URL('../app/composables/useAuthService.ts', import.meta.url),
    'utf8',
  );

  const callSites = authServiceSource.match(/onUnreachable:/g) ?? [];
  assert.equal(
    callSites.length,
    2,
    'both fetchUserWithRefresh and revalidate must handle the unreachable case',
  );

  const revalidateBody = authServiceSource.slice(
    authServiceSource.indexOf('async function revalidate('),
    authServiceSource.indexOf('function setTokens('),
  );
  assert.ok(revalidateBody.length > 0, 'revalidate body must be locatable');
  assert.match(
    revalidateBody,
    /onUnreachable:[\s\S]{0,200}'unknown-offline'/,
    'revalidate must set the unknown-offline state on transport failure',
  );
});

test('a failed session restore preserves webview cookies and stored tokens', async () => {
  // The core bug. When the shell's stored refresh token fails to redeem, the cause
  // is almost always that the web app already rotated it -- and the webview cookies
  // are still perfectly valid. Wiping them (CookieManager.clearAll) destroys a live
  // session and logs the user out for having used the app.
  //
  // Task 9: the restore-failure path must not clear cookies.
  // Task 11: it must not delete the stored tokens either. Deleting them removes the
  // only chance a later restore has of succeeding, and the token may be valid again
  // once the web app is not mid-rotation.
  //
  // Explicit logout keeps clearing everything: that is a user instruction, not an
  // inference from a failed request.
  const mobileAppSource = await readFile(
    new URL('../../mobile/App.tsx', import.meta.url),
    'utf8',
  );

  // Both boundaries are asserted to exist first. `indexOf` returns -1 for a name
  // that is not there, and `slice(start, -1)` silently returns the rest of the
  // file -- which swept the legitimate logout call sites into this slice and made
  // the assertion below fail against correct code.
  const restoreStart = mobileAppSource.indexOf('const restoreStoredSession');
  const restoreEnd = mobileAppSource.indexOf('const handleEmailLogin');
  assert.ok(restoreStart > 0, 'restoreStoredSession must exist');
  assert.ok(
    restoreEnd > restoreStart,
    'the slice boundary must exist and follow the start',
  );
  const restoreBody = mobileAppSource.slice(restoreStart, restoreEnd);

  assert.ok(
    !/clearStoredAuth\(\)/.test(restoreBody),
    'the restore path must not clear cookies or stored tokens on failure',
  );
  assert.match(
    restoreBody,
    /abandonRestore|keepStoredAuth/,
    'the restore path needs an explicit non-destructive give-up',
  );

  // The destructive helper must still exist and still delegate to the
  // platform-aware cleanup. `CookieManager.clearAll()` was too coarse on iOS:
  // it did not prove both the native and WebKit stores were cleared.
  assert.match(
    mobileAppSource,
    /const clearStoredAuth = async \(\) => \{[\s\S]*?clearMobileAuth\(\{/,
    'explicit logout must still clear cookies and stored tokens',
  );

  const clearCallSites = mobileAppSource.match(/clearStoredAuth\(\)/g) ?? [];
  assert.equal(
    clearCallSites.length,
    1,
    'only the shared explicit-logout finisher may clear stored auth',
  );

  const finishCallSites = mobileAppSource.match(/finishNativeLogout\(\)/g) ?? [];
  assert.equal(
    finishCallSites.length,
    2,
    'both explicit-logout message paths must use the destructive finisher',
  );
});
