const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const mobileRoot = path.resolve(__dirname, '..');
const read = (relativePath) => {
  const filePath = path.join(mobileRoot, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
};

const importTsModule = async (source) => {
  const filePath = path.join(mobileRoot, 'sentryScrub.ts');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  });
  const moduleInstance = new Module(filePath, module);
  moduleInstance.filename = filePath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filePath));
  moduleInstance._compile(transpiled.outputText, filePath);
  return moduleInstance.exports;
};

test('native crash telemetry is wired into Expo and the app root', () => {
  const packageJson = JSON.parse(read('package.json'));
  const appJson = JSON.parse(read('app.json'));
  const appSource = read('App.tsx');
  const telemetrySource = read('sentryTelemetry.ts');
  const buildScript = read('scripts/build.sh');

  assert.ok(packageJson.dependencies['@sentry/react-native']);
  const sentryPlugin = appJson.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === '@sentry/react-native/expo',
  );
  assert.deepEqual(sentryPlugin?.[1], {
    organization: 'jgplabs',
    project: 'maeil1dok-mobile',
  });
  assert.match(appSource, /import \* as Sentry from '@sentry\/react-native'/);
  assert.match(appSource, /initMobileTelemetry\(\)/);
  assert.match(appSource, /export default Sentry\.wrap\(App\)/);
  assert.match(telemetrySource, /Sentry\.init\(\{/);
  assert.match(telemetrySource, /dsn:\s*process\.env\.EXPO_PUBLIC_SENTRY_DSN/);
  assert.match(telemetrySource, /sendDefaultPii:\s*false/);
  assert.match(telemetrySource, /beforeSend:\s*scrubMobileSentryEvent/);
  assert.match(telemetrySource, /beforeSendTransaction:\s*scrubMobileSentryEvent/);
  assert.match(telemetrySource, /process\.env\.EXPO_PUBLIC_ENV/);
  assert.match(telemetrySource, /enableNative:\s*true/);
  assert.match(buildScript, /EXPO_PUBLIC_SENTRY_DSN/);
  assert.match(buildScript, /SENTRY_AUTH_TOKEN/);
});

test('mobile Sentry scrubber removes secrets and direct identifiers', async () => {
  const scrubSource = read('sentryScrub.ts');
  assert.ok(scrubSource, 'mobile/sentryScrub.ts must exist');
  const { scrubMobileSentryEvent } = await importTsModule(scrubSource);
  const secret = 'mobile-sentry-secret';
  const email = 'mobile-private@example.test';
  const event = {
    message: `failed for ${email}`,
    request: {
      url: `https://maeil1dok.app/callback?code=${secret}`,
      headers: { authorization: `Bearer ${secret}`, accept: 'application/json' },
      data: { refresh_token: secret, safe: 'keep' },
    },
    extra: {
      api_key: secret,
      serialized: `{"client_secret":"${secret}"}`,
      jwt: 'eyJheader.eyJpayload.signature',
    },
    user: { id: '73', email, ip_address: '203.0.113.10' },
  };

  const scrubbed = scrubMobileSentryEvent(structuredClone(event));
  const serialized = JSON.stringify(scrubbed);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes(email), false);
  assert.equal(serialized.includes('eyJheader.eyJpayload.signature'), false);
  assert.equal(scrubbed.request.headers.accept, 'application/json');
  assert.equal(scrubbed.request.data.safe, 'keep');
  assert.deepEqual(scrubbed.user, { id: '73' });
});
