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
const useRoute = () => ({ fullPath: '/plans/private' });`,
    )
    .replace(
      "import { useToast } from '~/composables/useToast';",
      'const useToast = () => globalThis.__guardToast;',
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

test('auth guard blocks offline actions without redirecting to login', async () => {
  const savedKeys = [
    '__guardAuth',
    '__guardNavigation',
    '__guardObservations',
    '__guardRouter',
    '__guardToast',
  ];
  const saved = Object.fromEntries(
    savedKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const observations = {
    redirects: [],
    reauthReports: [],
    toasts: [],
  };

  globalThis.__guardObservations = observations;
  globalThis.__guardAuth = {
    authState: { value: 'unknown-offline' },
    isAuthenticated: { value: false },
    isSessionUnknown: { value: true },
  };
  globalThis.__guardNavigation = {
    setRedirectUrl: (url) => observations.redirects.push(['remember', url]),
  };
  globalThis.__guardRouter = {
    push: (url) => observations.redirects.push(['push', url]),
  };
  globalThis.__guardToast = {
    info: (message) => observations.toasts.push(['info', message]),
    warning: (message) => observations.toasts.push(['warning', message]),
  };

  try {
    const { useAuthGuard } = await importAuthGuard();
    const { requireAuth } = useAuthGuard();

    assert.equal(requireAuth(), false, 'offline uncertainty must block the protected action');
    assert.deepEqual(
      observations.redirects,
      [],
      'unknown-offline must not be converted into a login navigation',
    );
    assert.deepEqual(
      observations.reauthReports,
      [],
      'offline uncertainty is not an involuntary sign-out event',
    );
  } finally {
    for (const key of savedKeys) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
  }
});
