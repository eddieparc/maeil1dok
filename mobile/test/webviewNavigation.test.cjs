const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadWebViewNavigationModule() {
  const filePath = path.join(__dirname, '..', 'webviewNavigation.ts');
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

const { shouldAllowWebViewNavigation, isFatalWebViewError } = loadWebViewNavigationModule();

const OPTIONS = {
  webAppUrl: 'https://maeil1dok.app/',
  apiUrl: 'https://api.maeil1dok.app',
};

// --- shouldAllowWebViewNavigation ---------------------------------------

test('YouTube 임베드가 띄우는 서드파티 광고 서브프레임은 차단하지 않는다', () => {
  // 차단하면 iOS WKWebView가 onError를 발생시켜 하세나 첫 진입에서 전체화면 에러가 뜬다.
  const adFrames = [
    'https://googleads.g.doubleclick.net/pagead/html/r20260820/r20190131/zrt_lookup_fy2021.html',
    'https://googleads.g.doubleclick.net/pagead/ads?client=ca-pub-8742107706365412&output=html',
    'https://ep2.adtrafficquality.google/sodar/sodar2/255/runner.html',
  ];

  for (const url of adFrames) {
    assert.equal(
      shouldAllowWebViewNavigation({ url, isTopFrame: false }, OPTIONS),
      true,
      `서브프레임이 차단됨: ${url}`,
    );
  }
});

test('메인 프레임의 외부 URL은 여전히 차단한다', () => {
  assert.equal(
    shouldAllowWebViewNavigation({ url: 'https://evil.example.com/phish', isTopFrame: true }, OPTIONS),
    false,
  );
});

test('isTopFrame 정보가 없으면 메인 프레임으로 간주해 기존 정책을 유지한다', () => {
  assert.equal(
    shouldAllowWebViewNavigation({ url: 'https://evil.example.com/phish' }, OPTIONS),
    false,
  );
});

test('앱 자신의 URL과 API URL은 허용한다', () => {
  assert.equal(shouldAllowWebViewNavigation({ url: 'https://maeil1dok.app/hasena', isTopFrame: true }, OPTIONS), true);
  assert.equal(shouldAllowWebViewNavigation({ url: 'https://api.maeil1dok.app/api/v1/todos/', isTopFrame: true }, OPTIONS), true);
  assert.equal(shouldAllowWebViewNavigation({ url: 'about:blank', isTopFrame: true }, OPTIONS), true);
});

test('로그인 페이지와 딥링크 스킴은 메인 프레임에서 계속 가로챈다', () => {
  assert.equal(shouldAllowWebViewNavigation({ url: 'https://maeil1dok.app/login', isTopFrame: true }, OPTIONS), false);
  assert.equal(shouldAllowWebViewNavigation({ url: 'youtube://watch?v=abc', isTopFrame: true }, OPTIONS), false);
  assert.equal(shouldAllowWebViewNavigation({ url: 'intent://watch?v=abc#Intent;end', isTopFrame: true }, OPTIONS), false);
});

test('OAuth 도메인과 YouTube 도메인은 허용한다', () => {
  assert.equal(shouldAllowWebViewNavigation({ url: 'https://kauth.kakao.com/oauth/authorize', isTopFrame: true }, OPTIONS), true);
  assert.equal(shouldAllowWebViewNavigation({ url: 'https://www.youtube.com/embed/m0nNPbhlt-4', isTopFrame: false }, OPTIONS), true);
});

// --- isFatalWebViewError ------------------------------------------------

test('취소(NSURLErrorCancelled -999)는 전체화면 에러로 승격하지 않는다', () => {
  assert.equal(
    isFatalWebViewError({ url: 'https://maeil1dok.app/hasena', code: -999, description: 'cancelled' }, OPTIONS),
    false,
  );
});

test('정책 변경에 의한 프레임 로드 중단(WebKit 102)은 전체화면 에러로 승격하지 않는다', () => {
  assert.equal(
    isFatalWebViewError({
      url: 'https://googleads.g.doubleclick.net/pagead/ads',
      code: 102,
      description: 'Frame load interrupted',
    }, OPTIONS),
    false,
  );
});

test('앱 도메인이 아닌 리소스 실패는 전체화면 에러로 승격하지 않는다', () => {
  assert.equal(
    isFatalWebViewError({
      url: 'https://ep2.adtrafficquality.google/sodar/sodar2/255/runner.html',
      code: -1009,
      description: 'The Internet connection appears to be offline.',
    }, OPTIONS),
    false,
  );
});

test('앱 메인 문서 로드 실패는 전체화면 에러로 승격한다', () => {
  assert.equal(
    isFatalWebViewError({
      url: 'https://maeil1dok.app/',
      code: -1009,
      description: 'The Internet connection appears to be offline.',
    }, OPTIONS),
    true,
  );
});

test('URL이 비어 있는 실패는 메인 문서 실패로 간주해 전체화면 에러로 승격한다', () => {
  assert.equal(
    isFatalWebViewError({ code: -1009, description: 'The Internet connection appears to be offline.' }, OPTIONS),
    true,
  );
});

test('description만으로도 취소를 판별한다', () => {
  assert.equal(
    isFatalWebViewError({ url: 'https://maeil1dok.app/hasena', description: 'Frame load interrupted' }, OPTIONS),
    false,
  );
});
