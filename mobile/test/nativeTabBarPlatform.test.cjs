const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'navigation', 'NativeTabBar.tsx'),
  'utf8',
);

test('keeps the React Native tab bar as the Android implementation', () => {
  assert.match(
    source,
    /platform === 'ios' && nativeViewAvailable/,
  );
  assert.match(
    source,
    /Platform\.OS === 'ios'\s*\?\s*requireNativeViewManager/,
  );
});
