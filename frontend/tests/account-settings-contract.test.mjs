import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transform } from 'esbuild';
import { compileTemplate, parse as parseSfc } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import {
  buildDeleteAccountPayload,
  buildNativeAppleLinkRequest,
  buildNotificationSettingsPayload,
  buildOAuthLinkUrl,
  buildPasswordMergePayload,
  buildSocialMergePayload,
  getProviderDisplayName,
  mergeEmailUpdateIntoAuthUser,
  parseNativeAppleLinkResult,
  shouldUseNativeAppleLink,
} from '../app/utils/accountSettingsRuntime.js';

const settingsSource = await readFile(
  new URL('../app/pages/account/settings.vue', import.meta.url),
  'utf8',
);
const profileSource = await readFile(
  new URL('../app/pages/profile/[id].vue', import.meta.url),
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
const authCallbackRuntimeSource = await readFile(
  new URL('../shared/utils/authCallbackRuntime.ts', import.meta.url),
  'utf8',
);
const parsedSettings = parseSfc(settingsSource, { filename: 'settings.vue' }).descriptor;
const parsedProfile = parseSfc(profileSource, { filename: 'profile.vue' }).descriptor;
const templateAst = parsedSettings.template?.ast;
const scriptSetupSource = parsedSettings.scriptSetup?.content ?? '';
const profileScriptSetupSource = parsedProfile.scriptSetup?.content ?? '';
const callbackScriptSource = parseSfc(callbackSource, { filename: 'callback.vue' }).descriptor.scriptSetup?.content ?? '';

const importAuthCallbackRuntime = async () => {
  const { code } = await transform(authCallbackRuntimeSource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

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

const compileSsrRender = (descriptor, filename, id) => {
  assert.ok(descriptor.template, `${filename} should have a template`);
  const compiled = compileTemplate({
    id,
    source: descriptor.template.content,
    filename,
    compilerOptions: { mode: 'function' },
  });
  assert.equal(compiled.errors.length, 0, `${filename} template should compile for SSR tests`);
  return new Function('Vue', `${compiled.code}; return render`)(Vue);
};

const settingsRender = compileSsrRender(parsedSettings, 'settings.vue', 'account-settings-contract');
const profileRender = compileSsrRender(parsedProfile, 'profile.vue', 'profile-settings-contract');

const LayoutStub = defineComponent({
  name: 'PageLayout',
  inheritAttrs: false,
  setup(_, { slots }) {
    return () => h('main', slots.default?.());
  },
});

const SilentStub = defineComponent({
  inheritAttrs: false,
  setup(_, { slots }) {
    return () => h('div', slots.default?.());
  },
});

const ImageStub = defineComponent({
  name: 'NuxtImg',
  setup(_, { attrs }) {
    return () => h('img', attrs);
  },
});

const mergeInfoFixture = {
  provider: 'google',
  code: 'single-use-code',
  current_account: {
    id: 1,
    nickname: '현재 사용자',
    email: 'current@example.com',
    profile_image: null,
    providers: ['kakao'],
    has_password: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  other_account: {
    id: 2,
    nickname: '기존 사용자',
    email: 'other@example.com',
    profile_image: null,
    providers: ['google'],
    has_password: false,
    created_at: '2025-01-01T00:00:00Z',
  },
};

async function renderAccountSettings(overrides = {}) {
  const linkedAccounts = overrides.linkedAccounts ?? {
    has_password: false,
    email: 'reader@example.com',
    auth_methods: {
      total: 1,
      social_count: 1,
    },
    linked_accounts: [
      {
        provider: 'google',
        email: 'reader@example.com',
        can_unlink: true,
      },
    ],
  };
  const getLinkedAccount = provider =>
    linkedAccounts.linked_accounts.find(account => account.provider === provider);
  const noOp = () => {};

  const component = defineComponent({
    name: 'AccountSettingsUnderTest',
    components: {
      PageLayout: LayoutStub,
      NuxtImg: ImageStub,
      SkeletonList: SilentStub,
    },
    setup() {
      return {
        user: {
          id: 1,
          nickname: '독자',
          email: 'reader@example.com',
          email_verified: true,
          has_usable_password_flag: true,
        },
        linkedAccounts,
        loading: false,
        PROVIDERS: ['kakao', 'google', 'apple'],
        showPasswordPanel: false,
        currentPassword: '',
        newPassword: '',
        newPasswordConfirm: '',
        passwordError: '',
        passwordLoading: false,
        accountActionLoading: false,
        showDeletePanel: overrides.showDeletePanel ?? true,
        deletePassword: '',
        deleteError: '',
        resendingEmail: false,
        emailCooldown: 0,
        emailButtonText: '인증 메일 발송',
        showMergeModal: overrides.showMergeModal ?? false,
        showMergeConfirmModal: false,
        mergeInfo: overrides.mergeInfo ?? mergeInfoFixture,
        // Diagnostic shell-bundle line. Hidden in a browser, which is what this
        // harness renders as.
        shellIdentity: overrides.shellIdentity ?? { state: 'not-in-app', visible: false, label: '' },
        mergeLoading: false,
        linkingProvider: overrides.linkingProvider ?? null,
        getProviderDisplayName,
        getLinkedAccount,
        isProviderLinked: provider => Boolean(getLinkedAccount(provider)),
        canUnlink: provider => getLinkedAccount(provider)?.can_unlink ?? false,
        formatDate: value => value,
        handleBack: noOp,
        handleResendVerification: noOp,
        handlePasswordAction: noOp,
        handleSetPassword: noOp,
        resetPasswordPanel: noOp,
        handleUnlink: noOp,
        handleLinkProvider: noOp,
        handleLogout: noOp,
        handleLogoutAllDevices: noOp,
        handleDeleteAccount: noOp,
        resetDeletePanel: noOp,
        handleMerge: noOp,
        closeMergeModal: noOp,
        navigateTo: noOp,
      };
    },
    render: settingsRender,
  });

  return renderToString(createSSRApp(component));
}

async function renderProfile({ isOwnProfile }) {
  const noOp = () => {};
  const component = defineComponent({
    name: 'ProfileUnderTest',
    components: {
      PageLayout: LayoutStub,
      NuxtImg: ImageStub,
      SkeletonProfileHeader: SilentStub,
      SkeletonStats: SilentStub,
      ProfileCalendar: SilentStub,
      ProfileAchievements: SilentStub,
      ProfileGroups: SilentStub,
      SkeletonList: SilentStub,
      SkeletonGroupCard: SilentStub,
      SkeletonCalendar: SilentStub,
      ErrorState: SilentStub,
      FollowersModal: SilentStub,
      FollowingModal: SilentStub,
      ProfileEditModal: SilentStub,
      UserIcon: SilentStub,
      UserRoundCheckIcon: SilentStub,
    },
    setup() {
      return {
        isLoading: false,
        profile: {
          user: {
            id: 1,
            nickname: '독자',
            profile_image: null,
          },
          joined_date: '2026-01-01T00:00:00Z',
          bio: '',
          is_following: false,
          is_mutual_follow: false,
          followers_count: 2,
          following_count: 3,
          total_completed_days: 10,
          current_streak: 2,
          longest_streak: 5,
        },
        isOwnProfile,
        isAuthenticated: true,
        completionRate: 50,
        activeTab: 'calendar',
        tabs: [{ id: 'calendar', label: '달력' }],
        loadingStates: {
          calendar: false,
          achievements: false,
          groups: false,
          followers: false,
          following: false,
        },
        calendarData: [],
        calendarPlans: [],
        achievementsData: [],
        groupsData: [],
        followersData: [],
        followingData: [],
        userId: 1,
        showFollowers: false,
        showFollowing: false,
        showEditModal: false,
        avatarError: false,
        error: null,
        formatDate: value => value,
        handleAvatarError: noOp,
        navigateToAccountSettings: noOp,
        navigateToNotificationSettings: noOp,
        toggleFollow: noOp,
        handleMonthChange: noOp,
        handleNavigateToDate: noOp,
        handleToggleFollow: noOp,
        handleUnfollow: noOp,
        handleProfileSaved: noOp,
      };
    },
    render: profileRender,
  });

  return renderToString(createSSRApp(component));
}

test('account settings uses typed account-management contracts instead of any-shaped data', () => {
  assert.doesNotMatch(scriptSetupSource, /ref<any>|:\s*any\b|catch\s*\([^)]*:\s*any\)/);
});

test('password-backed account deletion form binds password before posting explicit confirmation', async () => {
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

  assert.deepEqual(buildDeleteAccountPayload('account-password'), {
    password: 'account-password',
    confirm_delete: true,
  });

  const withoutPassword = await renderAccountSettings({
    linkedAccounts: {
      has_password: false,
      email: 'reader@example.com',
      auth_methods: { total: 1, social_count: 1 },
      linked_accounts: [],
    },
  });
  assert.match(withoutPassword, /계정 삭제는 보안을 위해 비밀번호 설정 후 진행할 수 있습니다/);
  assert.doesNotMatch(withoutPassword, /id="delete-password"/);
  assert.match(scriptSetupSource, /if\s*\(!deletePassword\.value\)/);
});

test('account settings uses project modal system instead of page-local teleported modals', () => {
  assert.equal(findElements(node => node.tag === 'Teleport').length, 0);
  // Confirm-modal behavior moved to Playwright: tests/e2e/browser-behavior.spec.ts.
  assert.match(scriptSetupSource, /modal\.alert/);
});

test('provider labels cover every linked provider in rendered actions', async () => {
  const rendered = await renderAccountSettings();
  for (const provider of ['kakao', 'google', 'apple']) {
    assert.match(rendered, new RegExp(`provider-icon ${provider}`));
  }

  const unlinkButtons = findElements(node =>
    node.tag === 'button' &&
    hasDirective(node, 'on:click', 'handleUnlink')
  );
  assert.equal(unlinkButtons.length, 1);

  for (const [provider, label] of [
    ['kakao', '카카오'],
    ['google', 'Google'],
    ['apple', 'Apple'],
  ]) {
    assert.equal(getProviderDisplayName(provider), label);
    assert.match(rendered, new RegExp(`>${label}<`));
  }
  assert.doesNotMatch(scriptSetupSource, /provider === 'kakao' \? '카카오' : '구글'/);
});

test('social linking uses server-issued state and sends it back to the API', async () => {
  // 검사 대상은 "이 엔드포인트를 부른다"이지 호출 헬퍼의 이름 표기가 아니다.
  // OpenAPI 계약 도입으로 `api.post` -> `api.POST`(생성 타입 기반)로 옮겨갔으므로
  // 두 표기를 모두 허용한다. 경로는 계약이므로 그대로 고정한다.
  assert.match(scriptSetupSource, /api\.(post|POST)\('\/api\/v1\/auth\/oauth\/link-state\/'\)/);
  assert.doesNotMatch(scriptSetupSource, /JSON\.stringify\(\{\s*action:\s*'link'\s*\}\)/);
  assert.doesNotMatch(callbackScriptSource, /state\.includes\([^)]*':'[^)]*\)/);

  const {
    buildLinkSocialPayload,
    firstQueryValue,
    isSignedLinkState,
  } = await importAuthCallbackRuntime();
  assert.equal(firstQueryValue(['first-state', 'ignored-state']), 'first-state');
  assert.equal(firstQueryValue('single-state'), 'single-state');
  assert.equal(firstQueryValue([null, 'ignored-state']), '');
  assert.equal(isSignedLinkState('header:payload:signature'), true);
  assert.equal(isSignedLinkState('header:payload'), false);
  assert.deepEqual(
    buildLinkSocialPayload('apple', 'single-use-code', 'header:payload:signature', 'apple-id-token'),
    {
      provider: 'apple',
      code: 'single-use-code',
      state: 'header:payload:signature',
      id_token: 'apple-id-token',
    },
  );
  assert.deepEqual(
    buildLinkSocialPayload('google', 'single-use-code', 'header:payload:signature', 'ignored-token'),
    {
      provider: 'google',
      code: 'single-use-code',
      state: 'header:payload:signature',
    },
  );
});

test('native callback only redirects tokens to allowlisted app schemes', async () => {
  const { getNativeAppScheme, getSafeAppScheme } = await importAuthCallbackRuntime();
  assert.equal(getSafeAppScheme('maeil1dok'), 'maeil1dok');
  assert.equal(getSafeAppScheme('maeil1dok-dev'), 'maeil1dok-dev');
  assert.equal(getSafeAppScheme('javascript'), '');
  assert.equal(getSafeAppScheme(null), '');
  assert.equal(getNativeAppScheme({ from: 'app', scheme: 'maeil1dok' }), 'maeil1dok');
  assert.equal(getNativeAppScheme({ from: 'web', scheme: 'maeil1dok' }), '');
  assert.equal(getNativeAppScheme({ from: 'app', scheme: 'https' }), '');
  assert.doesNotMatch(callbackScriptSource, /redirectToApp\([^,]+,\s*'[^']+',[\s\S]{0,160}stateData\?\.scheme/);
});

test('server native OAuth redirects use the same app scheme allowlist', async () => {
  const { getNativeAppScheme } = await importAuthCallbackRuntime();
  for (const scheme of ['maeil1dok', 'maeil1dok-dev']) {
    assert.equal(getNativeAppScheme({ from: 'app', scheme }), scheme);
  }
  for (const scheme of ['https', 'data', '', undefined]) {
    assert.equal(getNativeAppScheme({ from: 'app', scheme }), '');
  }
  for (const source of [serverOAuthRedirectSource, serverAppleCallbackSource]) {
    assert.doesNotMatch(source, /\$\{stateData\.scheme\}:\/\/auth\//);
  }
});

test('Google account linking has a guarded loading state and configuration error path', () => {
  assert.match(scriptSetupSource, /if \(!clientId \|\| !redirectUri\)/);
  assert.match(scriptSetupSource, /linkingProvider\.value = provider/);
  assert.match(scriptSetupSource, /window\.location\.assign\(authUrl\)/);
  assert.doesNotMatch(scriptSetupSource, /window\.location\.href = googleAuthUrl/);
});

test('account settings builds behavioral payloads for email, password merge, and notifications', async () => {
  assert.deepEqual(
    mergeEmailUpdateIntoAuthUser(
      { id: 1, email: 'same@example.com', email_verified: true },
      { email: 'same@example.com', email_verified: true },
      'same@example.com',
    ),
    { id: 1, email: 'same@example.com', email_verified: true },
  );
  assert.deepEqual(
    buildPasswordMergePayload({
      targetIdentifier: 'legacy-reader',
      targetPassword: 'target-pass-123',
      keepAccount: 'other',
    }),
    {
      merge_type: 'password',
      target_identifier: 'legacy-reader',
      target_password: 'target-pass-123',
      keep_account: 'other',
    },
  );
  assert.deepEqual(
    buildNotificationSettingsPayload({
      daily_reading_reminder: false,
      weekly_progress_summary: true,
      service_notice: false,
      reminder_time: '21:30',
    }),
    {
      daily_reading_reminder: false,
      weekly_progress_summary: true,
      service_notice: false,
      reminder_time: '21:30',
    },
  );
  const rendered = await renderAccountSettings({ showMergeModal: true });
  for (const label of ['이메일', '기존 계정 병합', '알림 설정']) {
    assert.match(rendered, new RegExp(label));
  }
});

test('OAuth and social merge helpers preserve link state and backend-issued merge token', async () => {
  const encodedState = 'signed:link/state+value';
  const googleUrl = new URL(buildOAuthLinkUrl('google', {
    clientId: 'qa-google-client',
    redirectUri: 'https://maeil1dok.app/auth/google/callback',
    baseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'email profile',
  }, encodedState));
  assert.equal(googleUrl.searchParams.get('client_id'), 'qa-google-client');
  assert.equal(googleUrl.searchParams.get('redirect_uri'), 'https://maeil1dok.app/auth/google/callback');
  assert.equal(googleUrl.searchParams.get('state'), encodedState);
  assert.equal(googleUrl.searchParams.get('response_type'), 'code');
  assert.equal(googleUrl.searchParams.get('access_type'), 'offline');
  assert.equal(googleUrl.searchParams.get('prompt'), 'consent');
  assert.deepEqual(
    buildSocialMergePayload({
      provider: 'google',
      code: 'single-use-code',
      merge_token: 'signed-merge-token',
    }, 'current'),
    {
      provider: 'google',
      code: 'single-use-code',
      keep_account: 'current',
      merge_token: 'signed-merge-token',
    },
  );
  const { getMergeToken } = await importAuthCallbackRuntime();
  assert.equal(getMergeToken({ merge_token: 'signed-merge-token' }), 'signed-merge-token');
  assert.equal(getMergeToken({ merge_token: 123 }), undefined);
  assert.equal(getMergeToken({ merge_token: '' }), undefined);
});

test('iOS shells route Apple linking through the native bridge', () => {
  assert.equal(shouldUseNativeAppleLink('apple', true), true);
  assert.equal(shouldUseNativeAppleLink('apple', false), false);
  assert.equal(shouldUseNativeAppleLink('google', true), false);
  assert.deepEqual(buildNativeAppleLinkRequest('one-time-state'), {
    type: 'auth:apple:link',
    data: { state: 'one-time-state' },
  });
});

test('native Apple link results accept credentials but reject malformed messages', () => {
  assert.deepEqual(parseNativeAppleLinkResult({
    type: 'auth:apple:link:result',
    data: {
      state: 'one-time-state',
      idToken: 'signed-id-token',
      code: 'authorization-code',
    },
  }), {
    state: 'one-time-state',
    idToken: 'signed-id-token',
    code: 'authorization-code',
  });

  assert.equal(parseNativeAppleLinkResult({
    type: 'auth:apple:link:result',
    data: { state: 'one-time-state', code: 'missing-token' },
  }), null);
});

test('profile page exposes account settings entry beside profile edit for own profile', async () => {
  const ownProfile = await renderProfile({ isOwnProfile: true });
  assert.match(ownProfile, />\s*프로필 편집\s*<\/button>/);
  assert.match(ownProfile, />\s*계정 설정\s*<\/button>/);

  const anotherProfile = await renderProfile({ isOwnProfile: false });
  assert.doesNotMatch(anotherProfile, />\s*프로필 편집\s*<\/button>/);
  assert.doesNotMatch(anotherProfile, />\s*계정 설정\s*<\/button>/);
  assert.match(profileScriptSetupSource, /navigateTo\('\/account\/settings'\)/);
});
