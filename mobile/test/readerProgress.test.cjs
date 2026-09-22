const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTsModule(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  });
  const moduleInstance = new Module(filePath, module);
  moduleInstance.filename = filePath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filePath));
  moduleInstance._compile(transpiled.outputText, filePath);
  return moduleInstance.exports;
}

const { readerScrollProgress } = loadTsModule('api/readerProgress.ts');

test('maps reader scroll offset to a bounded progress fraction', () => {
  assert.equal(readerScrollProgress(0, 1000, 400), 0);
  assert.equal(readerScrollProgress(300, 1000, 400), 0.5);
  assert.equal(readerScrollProgress(900, 1000, 400), 1);
  assert.equal(readerScrollProgress(-10, 1000, 400), 0);
  assert.equal(readerScrollProgress(0, 300, 400), 0);
});
