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

const { parseUser, parseLinkedAccounts, buildMenuItems } = loadTsModule('api/moreData.ts');

// --- parseUser ------------------------------------------------------------

test('parseUser maps the verified /auth/user/ contract', () => {
  const user = parseUser({
    id: 7,
    username: 'jgp',
    nickname: '지건',
    email: 'jgp@example.com',
    profile_image: 'https://cdn.example.com/avatar.png',
    is_staff: true,
    email_verified: true,
    has_usable_password_flag: false,
  });

  assert.deepEqual(user, {
    id: 7,
    username: 'jgp',
    nickname: '지건',
    email: 'jgp@example.com',
    profileImage: 'https://cdn.example.com/avatar.png',
    isStaff: true,
    emailVerified: true,
    hasUsablePassword: false,
  });
});

test('parseUser keeps null email and profile_image as null', () => {
  const user = parseUser({
    id: 3,
    username: 'social-only',
    nickname: '소셜',
    email: null,
    profile_image: null,
    is_staff: false,
    email_verified: false,
    has_usable_password_flag: true,
  });

  assert.equal(user.email, null);
  assert.equal(user.profileImage, null);
  assert.equal(user.isStaff, false);
});

test('parseUser falls back to username when nickname is missing or blank', () => {
  for (const nickname of [null, undefined, '']) {
    const user = parseUser({ id: 1, username: 'fallback', nickname });
    assert.equal(user.nickname, 'fallback', `nickname=${JSON.stringify(nickname)}`);
  }
});

test('parseUser rejects non-user payloads', () => {
  for (const bad of [null, undefined, 'x', 42, [], { username: 'no-id' }, { id: 'nan', username: 'x' }]) {
    assert.equal(parseUser(bad), null, `must reject: ${JSON.stringify(bad)}`);
  }
});

// --- parseLinkedAccounts ---------------------------------------------------

test('parseLinkedAccounts maps the verified contract', () => {
  const linked = parseLinkedAccounts({
    has_password: true,
    email: 'jgp@example.com',
    primary_email: 'jgp@example.com',
    auth_methods: { total: 3, password: 1, social_count: 2, providers: ['kakao', 'apple'] },
    linked_accounts: [
      {
        provider: 'kakao',
        provider_display: '카카오',
        email: 'k@example.com',
        profile_image: null,
        linked_at: '2026-01-01T00:00:00Z',
        can_unlink: true,
      },
      {
        provider: 'apple',
        provider_display: 'Apple',
        email: null,
        profile_image: 'https://cdn.example.com/a.png',
        linked_at: '2026-02-01T00:00:00Z',
        can_unlink: false,
      },
    ],
  });

  assert.equal(linked.hasPassword, true);
  assert.equal(linked.email, 'jgp@example.com');
  assert.equal(linked.primaryEmail, 'jgp@example.com');
  assert.deepEqual(linked.authMethods, { total: 3, password: 1, socialCount: 2 });
  assert.deepEqual(linked.providers, ['kakao', 'apple']);
  assert.equal(linked.accounts.length, 2);
  assert.deepEqual(linked.accounts[0], {
    provider: 'kakao',
    providerDisplay: '카카오',
    email: 'k@example.com',
    profileImage: null,
    linkedAt: '2026-01-01T00:00:00Z',
    canUnlink: true,
  });
  assert.equal(linked.accounts[1].canUnlink, false);
});

test('parseLinkedAccounts tolerates missing optional fields', () => {
  const linked = parseLinkedAccounts({ has_password: false, linked_accounts: [] });
  assert.equal(linked.hasPassword, false);
  assert.equal(linked.email, null);
  assert.deepEqual(linked.providers, []);
  assert.deepEqual(linked.accounts, []);
});

test('parseLinkedAccounts drops malformed account rows but keeps valid ones', () => {
  const linked = parseLinkedAccounts({
    has_password: false,
    linked_accounts: [
      { provider: 'kakao', provider_display: '카카오', can_unlink: true },
      'garbage',
      { no_provider: true },
    ],
  });
  assert.equal(linked.accounts.length, 1);
  assert.equal(linked.accounts[0].provider, 'kakao');
});

test('parseLinkedAccounts rejects non-object payloads', () => {
  for (const bad of [null, undefined, 'x', 42, []]) {
    assert.equal(parseLinkedAccounts(bad), null, `must reject: ${JSON.stringify(bad)}`);
  }
});

// --- buildMenuItems ---------------------------------------------------------

const EXPECTED_LINKS = [
  ['알림', '/notifications'],
  ['그룹', '/groups'],
  ['노트', '/bible/notes'],
  ['북마크', '/bible/bookmarks'],
  ['하이라이트', '/bible/highlights'],
  ['읽기 기록', '/bible/history'],
  ['계정 설정', '/account/settings'],
  ['알림 설정', '/notifications/settings'],
  ['공지', '/notice'],
  ['문의', '/support'],
];

test('buildMenuItems emits the web destinations in order', () => {
  const items = buildMenuItems({ betaEnabled: false });
  const links = items.filter((item) => item.kind === 'link');
  assert.deepEqual(
    links.map((item) => [item.label, item.path]),
    EXPECTED_LINKS,
  );
});

test('buildMenuItems ends with the logout row', () => {
  const items = buildMenuItems({ betaEnabled: false });
  const last = items[items.length - 1];
  assert.equal(last.kind, 'logout');
  assert.equal(last.label, '로그아웃');
});

test('buildMenuItems shows the beta row for every user', () => {
  // The web exposes the toggle to all users (the QA account is non-staff), so
  // the native menu does too — no staff gate.
  const items = buildMenuItems({ betaEnabled: false });
  const beta = items.find((item) => item.kind === 'beta');
  assert.ok(beta, 'every user must see the beta row');
  assert.equal(beta.enabled, false);
  // Beta row sits between the web links and logout.
  assert.equal(items[items.length - 1].kind, 'logout');
  assert.equal(items[items.length - 2].kind, 'beta');
});

test('buildMenuItems reflects the current beta flag on the row', () => {
  const on = buildMenuItems({ betaEnabled: true });
  assert.equal(on.find((item) => item.kind === 'beta').enabled, true);
});
