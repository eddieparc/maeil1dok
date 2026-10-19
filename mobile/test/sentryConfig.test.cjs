const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { getConfig } = require('@expo/config');

test('mobile source maps target the existing Maeil1Dok Sentry project', () => {
  const { exp } = getConfig(path.join(__dirname, '..'));
  const plugins = exp.plugins.filter(plugin =>
    Array.isArray(plugin) && plugin[0] === '@sentry/react-native/expo');
  assert.equal(plugins.length, 1);
  assert.equal(plugins[0][1].organization, 'c919d9f9be39');
  assert.equal(plugins[0][1].project, 'maeil1dok-mobile');
});
