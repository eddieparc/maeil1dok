const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

for (const screen of ['WebViewScreen.tsx', 'WebViewTabScreen.tsx']) {
  test(`${screen} exposes managed native push before page initialization`, () => {
    const file = path.join(__dirname, '../screens', screen);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let initializer;
    function visit(node) {
      if (ts.isJsxAttribute(node)
        && node.name.getText(source) === 'injectedJavaScriptBeforeContentLoaded') {
        initializer = node.initializer.expression.getText(source);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    const script = initializer
      ? new Function('Platform', `return (${initializer})`)({ OS: 'ios' })
      : '';
    const messages = [];
    const window = { ReactNativeWebView: { postMessage: value => messages.push(value) } };
    new Function('window', script)(window);
    // Observe the same capability contract a page reads at initialization.
    const supported = window.isReactNativeWebView === true
      && typeof window.ReactNativeWebView?.postMessage === 'function';
    assert.equal(supported, true, 'page must see native support on its first read');
    assert.equal(window.nativePushManaged, true);
    assert.equal(window.__shellBetaMode, true);
    assert.deepEqual(messages, [], 'bootstrapping must not request notification permission');
  });
}
