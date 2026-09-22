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
}

const { parseBibleReaderLocation } = loadTsModule('api/bibleBooks.ts');

test('parses schedule Korean book names and query parameters in either order', () => {
  assert.deepEqual(
    parseBibleReaderLocation('/bible?book=%EC%B0%BD%EC%84%B8%EA%B8%B0&chapter=2'),
    { book: 'gen', chapter: 2 },
  );
  assert.deepEqual(
    parseBibleReaderLocation('/bible?chapter=2&book=gen'),
    { book: 'gen', chapter: 2 },
  );
});

test('parses reader URLs and rejects invalid book chapter pairs', () => {
  assert.deepEqual(
    parseBibleReaderLocation('/bible/reading/gen/50'),
    { book: 'gen', chapter: 50 },
  );
  assert.equal(parseBibleReaderLocation('/bible?book=gen&chapter=51'), null);
  assert.equal(parseBibleReaderLocation('/bible?book=unknown&chapter=1'), null);
});
