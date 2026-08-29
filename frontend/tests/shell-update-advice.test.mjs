import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;

const importTsModule = async (source) => {
  const { code } = await transform(source, { format: 'esm', loader: 'ts', sourcemap: false });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const source = await readFile(
  new URL('../app/composables/shellUpdateAdvice.ts', import.meta.url),
  'utf8',
);
const { ANDROID_STORE_URL, IOS_STORE_URL, adviseShellUpdate } = await importTsModule(source);

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36 wv';

test('Given an ordinary browser Then nothing is shown', () => {
  // A desktop or mobile browser has no app to update. Nagging here would be pure
  // noise to users who are not the audience at all.
  const advice = adviseShellUpdate({ identityState: 'not-in-app', userAgent: IOS_UA });
  assert.equal(advice.mode, 'hidden');
});

test('Given the new shell Then nothing is shown even under blocking enforcement', () => {
  // The single most damaging failure would be locking out users who already have
  // the fix. `reported` means the shell told us its bundle, which only the new
  // shell can do.
  for (const enforcement of ['notice', 'blocking']) {
    const advice = adviseShellUpdate({
      identityState: 'reported',
      isAndroidHint: true,
      userAgent: ANDROID_UA,
      enforcement,
    });
    assert.equal(advice.mode, 'hidden', enforcement);
  }
});

test('Given the old shell on Android Then it is advised toward Play', () => {
  const advice = adviseShellUpdate({
    identityState: 'legacy-shell',
    isAndroidHint: true,
    userAgent: ANDROID_UA,
  });
  assert.equal(advice.mode, 'notice');
  assert.equal(advice.platform, 'android');
  assert.equal(advice.storeUrl, ANDROID_STORE_URL);
});

test('Given the old shell on iOS Then it is advised toward the App Store', () => {
  // The shell reports `isAndroidApp = false` on iOS, which is a stronger signal
  // than the user agent because a WebView UA can be overridden.
  const advice = adviseShellUpdate({
    identityState: 'legacy-shell',
    isAndroidHint: false,
    userAgent: IOS_UA,
  });
  assert.equal(advice.platform, 'ios');
  assert.equal(advice.storeUrl, IOS_STORE_URL);
});

test('Given no platform hint Then the user agent decides', () => {
  assert.equal(
    adviseShellUpdate({ identityState: 'legacy-shell', userAgent: IOS_UA }).platform,
    'ios',
  );
  assert.equal(
    adviseShellUpdate({ identityState: 'legacy-shell', userAgent: ANDROID_UA }).platform,
    'android',
  );
});

test('Given an unrecognised platform Then it still advises, without a dead link', () => {
  // Being unable to name the store is not a reason to withhold the one thing the
  // user can act on. A wrong store link would be worse than none.
  const advice = adviseShellUpdate({ identityState: 'legacy-shell', userAgent: 'something else' });
  assert.equal(advice.mode, 'notice');
  assert.equal(advice.platform, 'unknown');
  assert.equal(advice.storeUrl, null);
});

test('Given a non-boolean platform hint Then it is not coerced', () => {
  // `window.isAndroidApp` is injected as a literal. A string 'false' is truthy in
  // JavaScript and would send every iOS user to Play.
  const advice = adviseShellUpdate({
    identityState: 'legacy-shell',
    isAndroidHint: 'false',
    userAgent: IOS_UA,
  });
  assert.equal(advice.platform, 'ios');
});

test('Given blocking enforcement Then the old shell is locked out', () => {
  const advice = adviseShellUpdate({
    identityState: 'legacy-shell',
    isAndroidHint: true,
    userAgent: ANDROID_UA,
    enforcement: 'blocking',
  });
  assert.equal(advice.mode, 'blocking');
});

test('Given no enforcement setting Then it defaults to notice, never blocking', () => {
  // There is no newer store build yet. Defaulting to blocking would strand every
  // installed user with nothing to update to.
  const advice = adviseShellUpdate({ identityState: 'legacy-shell', isAndroidHint: true });
  assert.equal(advice.mode, 'notice');
});

test('Given an unknown enforcement string Then it degrades to notice', () => {
  const advice = adviseShellUpdate({
    identityState: 'legacy-shell',
    isAndroidHint: true,
    enforcement: 'nonsense',
  });
  assert.equal(advice.mode, 'notice');
});
