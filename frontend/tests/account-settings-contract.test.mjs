import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import compilerSfc from '../node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js';

const { parse: parseSfc } = compilerSfc;

const settingsSource = await readFile(
  new URL('../app/pages/account/settings.vue', import.meta.url),
  'utf8',
);
const callbackSource = await readFile(
  new URL('../app/pages/auth/[provider]/callback.vue', import.meta.url),
  'utf8',
);
const serverOAuthRedirectSource = await readFile(
  new URL('../server/middleware/oauth-app-redirect.ts', import.meta.url),
  'utf8',
);
const serverAppleCallbackSource = await readFile(
  new URL('../server/routes/auth/apple/callback.post.ts', import.meta.url),
  'utf8',
);
const parsedSettings = parseSfc(settingsSource, { filename: 'settings.vue' }).descriptor;
const templateAst = parsedSettings.template?.ast;
const scriptSetupSource = parsedSettings.scriptSetup?.content ?? '';
const callbackScriptSource = parseSfc(callbackSource, { filename: 'callback.vue' }).descriptor.scriptSetup?.content ?? '';

const walkTemplate = (node, visitor) => {
  visitor(node);
  for (const child of node.children ?? []) {
    walkTemplate(child, visitor);
  }
};

const findElements = (predicate) => {
  const matches = [];
  walkTemplate(templateAst, (node) => {
    if (node.type === 1 && predicate(node)) {
      matches.push(node);
    }
  });
  return matches;
};

const hasStaticProp = (node, name, value) =>
  node.props.some(prop => prop.type === 6 && prop.name === name && (!value || prop.value?.content === value));

const hasDirective = (node, name, expression) => {
  const [directiveName, argName] = name.split(':');
  return node.props.some(prop =>
    prop.type === 7 &&
    prop.name === directiveName &&
    (!argName || prop.arg?.content === argName) &&
    (!expression || prop.exp?.content.includes(expression))
  );
};

const collectText = (node) => {
  if (node.type === 2 || node.type === 5) {
    return node.content?.content ?? node.content ?? '';
  }
  return (node.children ?? []).map(collectText).join('');
};

test('account settings uses typed account-management contracts instead of any-shaped data', () => {
  for (const typeName of ['LinkedAccount', 'LinkedAccountsResponse', 'MergeAccountSummary']) {
    assert.match(scriptSetupSource, new RegExp(`interface ${typeName}\\b`));
  }
  assert.doesNotMatch(scriptSetupSource, /ref<any>|:\s*any\b|catch\s*\([^)]*:\s*any\)/);
});

test('password-backed account deletion form binds password before posting explicit confirmation', () => {
  const deletePasswordInputs = findElements(node =>
    node.tag === 'input' &&
    hasStaticProp(node, 'type', 'password') &&
    hasDirective(node, 'model', 'deletePassword')
  );
  assert.equal(deletePasswordInputs.length, 1);

  const deleteForms = findElements(node =>
    node.tag === 'form' &&
    hasDirective(node, 'on:submit', 'handleDeleteAccount')
  );
  assert.equal(deleteForms.length, 1);

  assert.match(scriptSetupSource, /password:\s*deletePassword\.value/);
  assert.match(scriptSetupSource, /confirm_delete:\s*true/);
  assert.match(scriptSetupSource, /if\s*\(!linkedAccounts\.value\?\.has_password\)/);
  assert.match(scriptSetupSource, /if\s*\(!deletePassword\.value\)/);
});

test('account settings uses project modal system instead of page-local teleported modals', () => {
  assert.equal(findElements(node => node.tag === 'Teleport').length, 0);
  assert.match(scriptSetupSource, /modal\.confirm/);
  assert.match(scriptSetupSource, /modal\.alert/);
});

test('provider labels cover every linked provider in rendered actions', () => {
  const socialButtons = findElements(node =>
    node.tag === 'button' &&
    hasDirective(node, 'on:click', 'handleLink')
  );
  assert.equal(socialButtons.length, 3);
  assert.deepEqual(
    socialButtons.map(button => {
      const expression = button.props.find(prop => prop.type === 7 && prop.name === 'on')?.exp?.content ?? '';
      return expression.replace('handleLink', '').toLowerCase();
    }).sort(),
    ['apple', 'google', 'kakao'],
  );

  const unlinkButtons = findElements(node =>
    node.tag === 'button' &&
    hasDirective(node, 'on:click', 'handleUnlink')
  );
  assert.equal(unlinkButtons.length, 3);

  for (const label of ['카카오', 'Google', 'Apple']) {
    assert.match(parsedSettings.template?.content ?? '', new RegExp(label));
  }

  assert.match(scriptSetupSource, /getProviderDisplayName\(provider\)/);
  for (const provider of ['kakao', 'google', 'apple']) {
    assert.match(scriptSetupSource, new RegExp(`${provider}:\\s*'[^']+'`));
  }
  assert.doesNotMatch(scriptSetupSource, /provider === 'kakao' \? '카카오' : '구글'/);
});

test('social linking uses server-issued state and sends it back to the API', () => {
  assert.match(scriptSetupSource, /api\.post\('\/api\/v1\/auth\/oauth\/link-state\/'\)/);
  assert.match(scriptSetupSource, /encodeURIComponent\(state\)/);
  assert.doesNotMatch(scriptSetupSource, /JSON\.stringify\(\{\s*action:\s*'link'\s*\}\)/);

  assert.match(callbackScriptSource, /const state = firstQueryValue\(route\.query\.state\)/);
  assert.match(callbackScriptSource, /isSignedLinkState\(state\)/);
  assert.match(callbackScriptSource, /SIGNED_LINK_STATE_PATTERN\.test\(state\)/);
  assert.doesNotMatch(callbackScriptSource, /state\.includes\([^)]*':'[^)]*\)/);
  assert.match(callbackScriptSource, /const payload: Record<string, string> = \{ provider, code, state \}/);
});

test('native callback only redirects tokens to allowlisted app schemes', () => {
  assert.match(callbackScriptSource, /ALLOWED_APP_SCHEMES = new Set\(\['maeil1dok', 'maeil1dok-dev'\]\)/);
  assert.match(callbackScriptSource, /getSafeAppScheme\(stateData\?\.scheme\)/);
  assert.match(callbackScriptSource, /stateData\?\.from === 'app' && Boolean\(safeAppScheme\)/);
  assert.doesNotMatch(callbackScriptSource, /redirectToApp\([^,]+,\s*'[^']+',[\s\S]{0,160}stateData\?\.scheme/);
});

test('server native OAuth redirects use the same app scheme allowlist', () => {
  for (const source of [serverOAuthRedirectSource, serverAppleCallbackSource]) {
    assert.match(source, /ALLOWED_APP_SCHEMES = new Set\(\['maeil1dok', 'maeil1dok-dev'\]\)/);
    assert.match(source, /getSafeAppScheme\(stateData\?\.scheme\)/);
    assert.doesNotMatch(source, /\$\{stateData\.scheme\}:\/\/auth\//);
  }
});
