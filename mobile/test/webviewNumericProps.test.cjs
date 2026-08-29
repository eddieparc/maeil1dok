const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

/**
 * Fabric codegen types these WebView props as Float. The old bridge tolerated the
 * documented string forms ('normal' / 'fast'); the new architecture does not, and
 * `RNCWebViewManagerDelegate.setProperty` casts straight to Double:
 *
 *   java.lang.ClassCastException: java.lang.String cannot be cast to java.lang.Double
 *
 * `app.json` sets `newArchEnabled: true`, so a string here is a launch crash on
 * Android, observed on the emulator before this was fixed.
 */
const NUMERIC_WEBVIEW_PROPS = ['decelerationRate'];

const source = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');

for (const prop of NUMERIC_WEBVIEW_PROPS) {
  test(`${prop} is passed as a number, not a string`, () => {
    assert.equal(
      source.includes(`${prop}="`),
      false,
      `${prop} must not be given a string literal under the new architecture`,
    );
  });
}
