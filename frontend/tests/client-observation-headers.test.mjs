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
  new URL('../app/composables/clientObservationHeaders.ts', import.meta.url),
  'utf8',
);
const { buildClientObservationHeaders } = await importTsModule(source);

test('ordinary browsers identify as web without inventing app metadata', () => {
  assert.deepEqual(
    buildClientObservationHeaders({
      isNativeApp: false,
      isAndroidApp: false,
      shellIdentity: undefined,
    }),
    { 'X-Client': 'web', 'X-App-Platform': 'web' },
  );
});

test('legacy Android shells are separated from unknown browser traffic', () => {
  assert.deepEqual(
    buildClientObservationHeaders({
      isNativeApp: true,
      isAndroidApp: true,
      shellIdentity: undefined,
    }),
    { 'X-Client': 'legacy-shell', 'X-App-Platform': 'android' },
  );
});

test('reported shells send bounded platform and app version metadata', () => {
  assert.deepEqual(
    buildClientObservationHeaders({
      isNativeApp: true,
      isAndroidApp: true,
      shellIdentity: { appVersion: '1.2.3' },
    }),
    {
      'X-Client': 'shell',
      'X-App-Platform': 'android',
      'X-App-Version': '1.2.3',
    },
  );
});

test('malformed app versions are omitted', () => {
  const headers = buildClientObservationHeaders({
    isNativeApp: true,
    isAndroidApp: false,
    shellIdentity: { appVersion: 'v'.repeat(100) },
  });

  assert.equal(headers['X-Client'], 'shell');
  assert.equal(headers['X-App-Platform'], 'ios');
  assert.equal('X-App-Version' in headers, false);
});
