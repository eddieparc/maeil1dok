const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filePath = path.join(__dirname, '..', 'App.tsx');
const sourceFile = ts.createSourceFile(
  filePath,
  fs.readFileSync(filePath, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function findWebView(node) {
  if (
    ts.isJsxSelfClosingElement(node)
    && ts.isIdentifier(node.tagName)
    && node.tagName.text === 'WebView'
  ) {
    return node;
  }

  return ts.forEachChild(node, findWebView);
}

test('iOS WebContent 종료 시 기존 재시도 경로로 WebView를 복구한다', () => {
  // Given: the production WebView JSX node
  const webView = findWebView(sourceFile);
  assert.ok(webView, 'App.tsx must render a WebView');

  // When: inspecting the callback consumed by react-native-webview on iOS
  const attribute = webView.attributes.properties.find(
    (property) => (
      ts.isJsxAttribute(property)
      && property.name.text === 'onContentProcessDidTerminate'
    ),
  );

  // Then: content-process termination must use the same reload path as manual retry
  assert.ok(attribute && ts.isJsxAttribute(attribute), 'missing iOS WebContent recovery callback');
  assert.ok(attribute.initializer && ts.isJsxExpression(attribute.initializer));
  assert.ok(attribute.initializer.expression && ts.isIdentifier(attribute.initializer.expression));
  assert.equal(attribute.initializer.expression.text, 'handleRetry');
});
