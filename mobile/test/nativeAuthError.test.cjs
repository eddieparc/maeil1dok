const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadModule() {
  const filePath = path.join(__dirname, '..', 'nativeAuthError.ts');
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

test('native auth errors keep backend detail and request id', () => {
  const { formatNativeAuthError } = loadModule();

  assert.equal(
    formatNativeAuthError(
      {
        error: '소셜 계정 인증 정보를 확인하지 못했습니다.',
        error_code: 'provider_auth_failed',
        request_id: 'request-native-1',
      },
      '로그인에 실패했습니다.',
    ),
    '소셜 계정 인증 정보를 확인하지 못했습니다.\n오류 ID: request-native-1',
  );
});

test('native auth transport fallbacks stay specific to the attempted action', () => {
  const { formatNativeAuthError } = loadModule();

  assert.equal(
    formatNativeAuthError(null, '카카오 로그인 서버에 연결하지 못했습니다.'),
    '카카오 로그인 서버에 연결하지 못했습니다.',
  );
});
