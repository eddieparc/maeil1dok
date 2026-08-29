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
  new URL('../app/composables/shellBundleIdentity.ts', import.meta.url),
  'utf8',
);
const { classifyShellIdentity } = await importTsModule(source);

test('Given an ordinary browser Then nothing is shown', () => {
  const result = classifyShellIdentity({ isNativeApp: false, reported: undefined });
  assert.equal(result.state, 'not-in-app');
  assert.equal(result.visible, false);
});

test('Given the app shell that reports nothing Then it is the old bundle', () => {
  // The old shell injects `isReactNativeWebView` but knows nothing about bundle
  // identity. Being inside the app while reporting nothing is therefore a positive
  // answer, not missing data: the OTA has not been applied here.
  const result = classifyShellIdentity({ isNativeApp: true, reported: undefined });
  assert.equal(result.state, 'legacy-shell');
  assert.equal(result.visible, true);
  assert.match(result.label, /미도달|구버전/);
});

test('Given a shell running an applied OTA Then the short update id is shown', () => {
  const result = classifyShellIdentity({
    isNativeApp: true,
    reported: {
      updateId: '01a04ce6-484c-7bf1-ac21-2fb0b665666d',
      runtimeVersion: '1.2.2',
      isEmbedded: false,
      channel: 'production',
    },
  });
  assert.equal(result.state, 'reported');
  assert.equal(result.visible, true);
  assert.ok(result.label.includes('1.2.2'), result.label);
  assert.ok(result.label.includes('01a04ce6'), result.label);
});

test('Given a shell running its embedded bundle Then it says embedded, not an id', () => {
  const result = classifyShellIdentity({
    isNativeApp: true,
    reported: {
      updateId: '251d5f1a-4d2b-4efe-9137-448b7007b851',
      runtimeVersion: '1.2.2',
      isEmbedded: true,
      channel: 'production',
    },
  });
  assert.equal(result.state, 'reported');
  assert.ok(result.label.includes('embedded'), result.label);
  assert.equal(result.label.includes('251d5f1a'), false, result.label);
});

test('Given a malformed report Then it degrades instead of throwing', () => {
  for (const reported of ['nonsense', 42, null, {}, { updateId: 7 }]) {
    const result = classifyShellIdentity({ isNativeApp: true, reported });
    assert.equal(typeof result.label, 'string');
    assert.equal(result.visible, true);
  }
});
