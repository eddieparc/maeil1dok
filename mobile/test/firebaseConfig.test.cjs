const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { getConfig } = require('@expo/config');

for (const filePath of [undefined, '/tmp/eas-google-services.json']) {
  test(`Firebase client config uses ${filePath ? 'the EAS file' : 'the local file'} without changing app identity`, t => {
    const previous = process.env.GOOGLE_SERVICES_JSON;
    if (filePath) process.env.GOOGLE_SERVICES_JSON = filePath;
    else delete process.env.GOOGLE_SERVICES_JSON;
    t.after(() => {
      if (previous === undefined) delete process.env.GOOGLE_SERVICES_JSON;
      else process.env.GOOGLE_SERVICES_JSON = previous;
    });
    const { exp } = getConfig(path.join(__dirname, '..'));
    assert.equal(exp.android.googleServicesFile, filePath ?? './google-services.json');
    assert.equal(exp.android.package, 'app.maeil1dok.mobile');
    assert.equal(exp.ios.bundleIdentifier, 'com.maeil1dok.app');
  });
}
