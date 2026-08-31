const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadBridgeModule() {
  const filePath = path.join(__dirname, '..', 'certificationImageBridge.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  });

  const moduleInstance = new Module(filePath, module);
  moduleInstance.filename = filePath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filePath));
  moduleInstance._compile(transpiled.outputText, filePath);
  return moduleInstance.exports;
}

const { handleCertificationImageMessage } = loadBridgeModule();

const createDependencies = () => {
  const calls = [];
  return {
    calls,
    dependencies: {
      async writeImage(fileName, base64) {
        calls.push({ operation: 'write', fileName, base64 });
        return `file:///cache/${fileName}`;
      },
      async shareImage(fileUri) {
        calls.push({ operation: 'share', fileUri });
      },
      async saveImage(fileUri) {
        calls.push({ operation: 'save', fileUri });
      },
    },
  };
};

const message = (action) => ({
  type: 'certification:image',
  action,
  fileName: 'maeil1dok-tongdok-certification.png',
  dataUrl: 'data:image/png;base64,Y2VydGlmaWNhdGlvbi1wbmc=',
});

test('shares a validated certification PNG through the native adapter', async () => {
  const { calls, dependencies } = createDependencies();

  const handled = await handleCertificationImageMessage(message('share'), dependencies);

  assert.equal(handled, true);
  assert.deepEqual(calls, [
    {
      operation: 'write',
      fileName: 'maeil1dok-tongdok-certification.png',
      base64: 'Y2VydGlmaWNhdGlvbi1wbmc=',
    },
    {
      operation: 'share',
      fileUri: 'file:///cache/maeil1dok-tongdok-certification.png',
    },
  ]);
});

test('saves a validated certification PNG through the native adapter', async () => {
  const { calls, dependencies } = createDependencies();

  const handled = await handleCertificationImageMessage(message('save'), dependencies);

  assert.equal(handled, true);
  assert.equal(calls[1].operation, 'save');
  assert.equal(calls[1].fileUri, 'file:///cache/maeil1dok-tongdok-certification.png');
});

test('rejects malformed bridge messages without native side effects', async () => {
  const { calls, dependencies } = createDependencies();

  const handled = await handleCertificationImageMessage(
    {
      type: 'certification:image',
      action: 'share',
      fileName: '../escape.png',
      dataUrl: 'data:text/plain;base64,bm90LWEtcG5n',
    },
    dependencies,
  );

  assert.equal(handled, false);
  assert.deepEqual(calls, []);
});
