import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;

const authServiceSource = await readFile(
  new URL('../app/composables/useAuthService.ts', import.meta.url),
  'utf8',
);
const authGuardSource = await readFile(
  new URL('../app/composables/useAuthGuard.ts', import.meta.url),
  'utf8',
);

const importAuthService = async () => {
  const runnableSource = authServiceSource
    .replace("import { readCsrfToken, storeCsrfToken } from './csrfCookie'",
      await readFile(new URL('../app/composables/csrfCookie.ts', import.meta.url), 'utf8'))
    .replace(
      "import { computed, readonly } from 'vue'",
      `const computed = (getter) => ({ get value() { return getter() } });
const readonly = (value) => value;`,
    )
    .replace(
      `import {
  fetchInitialAuthUser,
  fetchUserWithRefreshPolicy,
  type RefreshOutcome,
  refreshWithCsrfRecovery,
  revalidateAuthSession,
} from './authSessionPolicy'`,
      `const fetchInitialAuthUser = async (_cachedUser, dependencies) =>
  dependencies.fetchUserWithRefresh();
const fetchUserWithRefreshPolicy = async (dependencies) => {
  dependencies.onUnreachable?.();
  return null;
};
const refreshWithCsrfRecovery = async () => ({ ok: false, reason: 'unreachable' });
const revalidateAuthSession = async () => null;`,
    )
    .replace(
      `import {
  REAUTH_MARKER_KEY,
  classifyAuthRender,
  createReauthMarker,
  parseReauthMarker,
  shouldReportInvoluntaryReauth,
} from './reauthMarker'`,
      `const REAUTH_MARKER_KEY = 'auth:was-authenticated';
const classifyAuthRender = () => 'miss';
const createReauthMarker = () => ({});
const parseReauthMarker = () => null;
const shouldReportInvoluntaryReauth = () => false;`,
    )
    .replaceAll('import.meta.client', 'true')
    .replaceAll('import.meta.server', 'false');

  const { code } = await transform(runnableSource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const importAuthGuard = async () => {
  const runnableSource = authGuardSource
    .replace(
      "import { reportInvoluntaryReauthIfMarked, useAuthService } from '~/composables/useAuthService';",
      `const reportInvoluntaryReauthIfMarked = (...args) =>
  globalThis.__guardObservations.reauthReports.push(args);
const useAuthService = () => globalThis.__guardAuth;`,
    )
    .replace(
      "import { useNavigationStore } from '~/stores/navigation';",
      'const useNavigationStore = () => globalThis.__guardNavigation;',
    )
    .replace(
      "import { useRouter, useRoute } from 'vue-router';",
      `const useRouter = () => globalThis.__guardRouter;
const useRoute = () => globalThis.__guardRoute;`,
    )
    .replace(
      "import { useToast } from '~/composables/useToast';",
      'const useToast = () => globalThis.__guardToast;',
    )
    .replace(
      "import { useModal } from '~/composables/useModal';",
      'const useModal = () => globalThis.__guardModal;',
    );

  const { code } = await transform(runnableSource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const withAuthEnvironment = async (cachedUser, run) => {
  const keys = [
    'document',
    'fetch',
    'localStorage',
    'navigateTo',
    'useRuntimeConfig',
    'useState',
    'window',
  ];
  const saved = Object.fromEntries(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const store = new Map([['auth', JSON.stringify({ user: cachedUser })]]);
  const states = new Map();
  let resolveInitialized;
  const initialized = new Promise((resolve) => {
    resolveInitialized = resolve;
  });

  globalThis.window = {
    addEventListener: (eventName) => {
      if (eventName === 'storage') resolveInitialized();
    },
  };
  globalThis.document = {
    addEventListener: () => {},
    cookie: '',
    hidden: false,
  };
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  globalThis.fetch = async () => {
    throw new Error('network should be represented by the policy stub');
  };
  globalThis.navigateTo = () => {};
  globalThis.useRuntimeConfig = () => ({
    internalApiBase: '',
    public: { apiBase: 'http://api.test' },
  });
  globalThis.useState = (key, initializer) => {
    if (!states.has(key)) states.set(key, { value: initializer() });
    return states.get(key);
  };

  try {
    return await run({ initialized, states, store });
  } finally {
    for (const key of keys) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
  }
};

test('initialize preserves cached identity when the server is unreachable', async () => {
  const cachedUser = {
    id: 17,
    username: 'offline-user',
    nickname: '오프라인 사용자',
  };

  await withAuthEnvironment(cachedUser, async ({ initialized, store }) => {
    const { useAuthService } = await importAuthService();
    const auth = useAuthService();

    auth.initialize();
    await initialized;

    assert.equal(auth.authState.value, 'unknown-offline');
    assert.deepEqual(auth.user.value, cachedUser);
    assert.deepEqual(JSON.parse(store.get('auth')).user, cachedUser);
  });
});

test('initialize repairs an incoherent hydrated initialized/loading state', async () => {
  const cachedUser = {
    id: 18,
    username: 'hydrated-user',
    nickname: 'Hydrated User',
  };

  await withAuthEnvironment(cachedUser, async ({ states }) => {
    states.set('auth:initialized', { value: true });
    states.set('auth:state', { value: 'loading' });
    const { useAuthService } = await importAuthService();
    const auth = useAuthService();

    await auth.initialize();

    assert.equal(auth.authState.value, 'unknown-offline');
    assert.deepEqual(auth.user.value, cachedUser);
  });
});

const withGuardEnvironment = async ({
  authenticated = false,
  sessionUnknown = false,
  fullPath = '/bible?book=gen&chapter=49',
  confirm = async () => false,
} = {}, run) => {
  const savedKeys = [
    '__guardAuth',
    '__guardModal',
    '__guardNavigation',
    '__guardObservations',
    '__guardRoute',
    '__guardRouter',
    '__guardToast',
  ];
  const saved = Object.fromEntries(
    savedKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const observations = {
    prompts: [],
    redirects: [],
    reauthReports: [],
    toasts: [],
  };
  const route = { fullPath };

  const auth = {
    authState: { value: sessionUnknown ? 'unknown-offline' : authenticated ? 'authenticated' : 'unauthenticated' },
    isAuthenticated: { value: authenticated },
    isSessionUnknown: { value: sessionUnknown },
  };
  globalThis.__guardObservations = observations;
  globalThis.__guardAuth = auth;
  globalThis.__guardModal = {
    confirm: (options) => {
      observations.prompts.push(options);
      return confirm(options);
    },
  };
  globalThis.__guardNavigation = {
    setRedirectUrl: (url) => observations.redirects.push(['remember', url]),
  };
  globalThis.__guardRoute = route;
  globalThis.__guardRouter = {
    push: (url) => observations.redirects.push(['push', url]),
  };
  globalThis.__guardToast = {
    info: (message) => observations.toasts.push(['info', message]),
    warning: (message) => observations.toasts.push(['warning', message]),
  };

  try {
    const { useAuthGuard } = await importAuthGuard();
    await run({ auth, guard: useAuthGuard(), observations, route });
  } finally {
    for (const key of savedKeys) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
  }
};

test('auth guard blocks offline actions without redirecting or prompting for login', async () => {
  await withGuardEnvironment({ sessionUnknown: true }, async ({ guard, observations }) => {
    assert.equal(await guard.requireAuthWithPrompt(), false);
    assert.deepEqual(observations.prompts, []);
    assert.deepEqual(observations.redirects, []);
    assert.deepEqual(observations.reauthReports, []);
    assert.equal(observations.toasts.length, 1);
  });
});

test('authenticated prompt guard passes without opening a dialog', async () => {
  await withGuardEnvironment({ authenticated: true }, async ({ guard, observations }) => {
    assert.equal(await guard.requireAuthWithPrompt(), true);
    assert.deepEqual(observations.prompts, []);
    assert.deepEqual(observations.redirects, []);
  });
});

test('guest prompt cancellation leaves the current route and return state untouched', async () => {
  await withGuardEnvironment({}, async ({ guard, observations }) => {
    assert.equal(await guard.requireAuthWithPrompt(), false);
    assert.equal(observations.prompts.length, 1);
    assert.deepEqual(observations.redirects, []);
    assert.deepEqual(observations.reauthReports, []);
  });
});

test('guest prompt confirmation captures the return route before navigating and reports reauth', async () => {
  let resolveConfirmation;
  const confirmation = new Promise((resolve) => { resolveConfirmation = resolve; });
  await withGuardEnvironment({ confirm: () => confirmation }, async ({ guard, observations, route }) => {
    const pending = guard.requireAuthWithPrompt();
    await Promise.resolve();
    assert.equal(observations.prompts.length, 1);
    route.fullPath = '/bible?book=exo&chapter=1';
    resolveConfirmation(true);
    assert.equal(await pending, false);
    assert.deepEqual(observations.redirects, [
      ['remember', '/bible?book=gen&chapter=49'],
      ['push', '/login'],
    ]);
    assert.deepEqual(observations.reauthReports, [[true]]);
  });
});

test('a guest action stays blocked if authentication becomes true while its prompt is open', async () => {
  let resolveConfirmation;
  const confirmation = new Promise((resolve) => { resolveConfirmation = resolve; });
  await withGuardEnvironment({ confirm: () => confirmation }, async ({ auth, guard, observations }) => {
    const pending = guard.requireAuthWithPrompt();
    await Promise.resolve();
    assert.equal(observations.prompts.length, 1);
    auth.authState.value = 'authenticated';
    auth.isAuthenticated.value = true;
    resolveConfirmation(true);
    assert.equal(await pending, false, 'the originating guest action must not be replayed');
    assert.deepEqual(observations.redirects, [], 'an authenticated user needs no login navigation');
    assert.deepEqual(observations.reauthReports, []);
  });
});

test('default guard keeps immediate redirect behavior for non-opt-in consumers', async () => {
  await withGuardEnvironment({}, async ({ guard, observations }) => {
    assert.equal(guard.requireAuth(), false);
    assert.deepEqual(observations.prompts, []);
    assert.deepEqual(observations.redirects, [
      ['remember', '/bible?book=gen&chapter=49'],
      ['push', '/login'],
    ]);
    assert.deepEqual(observations.reauthReports, [[true]]);
  });
});
