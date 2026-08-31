import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const readOptional = async (url) => {
  try {
    return await readFile(url, 'utf8');
  } catch {
    return '';
  }
};

const scrubSource = await readOptional(
  new URL('../sentry-scrub.ts', import.meta.url),
);
const clientConfig = await readFile(
  new URL('../sentry.client.config.ts', import.meta.url),
  'utf8',
);
const serverConfig = await readFile(
  new URL('../sentry.server.config.ts', import.meta.url),
  'utf8',
);
const errorHandler = await readFile(
  new URL('../app/composables/useErrorHandler.ts', import.meta.url),
  'utf8',
);
const errorPage = await readFile(
  new URL('../app/error.vue', import.meta.url),
  'utf8',
);

const importTsModule = async (source) => {
  const { code } = await esbuild.transform(source, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

test('client and server Sentry configs enforce one scrub boundary', () => {
  assert.ok(scrubSource, 'frontend/sentry-scrub.ts must exist');
  for (const config of [clientConfig, serverConfig]) {
    assert.match(config, /import\s+\{\s*scrubSentryEvent\s*\}\s+from\s+['"]\.\/sentry-scrub['"]/);
    assert.match(config, /beforeSend:\s*scrubSentryEvent/);
    assert.match(config, /beforeSendTransaction:\s*scrubSentryEvent/);
    assert.match(config, /sendDefaultPii:\s*false/);
  }
  assert.match(clientConfig, /tracePropagationTargets:/);
  assert.match(serverConfig, /tracePropagationTargets:/);
});

test('Sentry scrubber removes secrets and direct identifiers recursively', async () => {
  assert.ok(scrubSource, 'frontend/sentry-scrub.ts must exist');
  const { scrubSentryEvent } = await importTsModule(scrubSource);
  const secrets = [
    'access-secret',
    'refresh-secret',
    'Bearer bearer-secret',
    'private-person@example.test',
    'cookie-secret',
    'api-secret',
    'client-secret',
    'eyJheader.eyJpayload.signature',
  ];
  const event = {
    message: 'failed for private-person@example.test {"client_secret":"client-secret"} eyJheader.eyJpayload.signature',
    request: {
      url: 'https://maeil1dok.app/callback?access_token=access-secret&safe=keep',
      headers: {
        authorization: 'Bearer bearer-secret',
        cookie: 'refresh_token=refresh-secret; csrftoken=cookie-secret',
        accept: 'application/json',
      },
      data: {
        password: 'password-secret',
        nested: { refresh_token: 'refresh-secret', safe: 'keep' },
      },
    },
    user: {
      id: '73',
      email: 'private-person@example.test',
      ip_address: '203.0.113.8',
    },
    extra: {
      callback: '/done?code=access-secret',
      api_key: 'api-secret',
      refresh: 'refresh-secret',
    },
  };

  const scrubbed = scrubSentryEvent(structuredClone(event));
  const serialized = JSON.stringify(scrubbed);
  for (const secret of secrets) {
    assert.equal(serialized.includes(secret), false, secret);
  }
  assert.equal(scrubbed.request.headers.accept, 'application/json');
  assert.equal(scrubbed.request.data.nested.safe, 'keep');
  assert.equal(scrubbed.user.id, '73');
  assert.equal('email' in scrubbed.user, false);
  assert.equal('ip_address' in scrubbed.user, false);
});

test('caught production failures are sent to Sentry before recovery', () => {
  assert.match(errorHandler, /import \* as Sentry from ['"]@sentry\/nuxt['"]/);
  assert.match(errorHandler, /Sentry\.captureException\(/);
  assert.match(errorHandler, /Sentry\.captureMessage\(/);
  assert.match(errorHandler, /scope\.setTag\(['"]handled['"], ['"]true['"]\)/);

  assert.match(errorPage, /import \* as Sentry from ['"]@sentry\/nuxt['"]/);
  assert.match(errorPage, /Sentry\.captureException\(props\.error/);
  assert.ok(
    errorPage.indexOf('Sentry.captureException(props.error)')
      < errorPage.lastIndexOf("clearError({ redirect: '/' })"),
    'SSR error must be captured before recovery clears it',
  );
});
