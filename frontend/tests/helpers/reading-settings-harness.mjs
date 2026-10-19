import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const { createPinia, setActivePinia } = require('pinia');
const { ref } = require('vue');
export const runtime = {};
globalThis.__readingRecovery = runtime;
const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../../app/stores/readingSettings.ts', import.meta.url))],
  bundle: true, format: 'cjs', platform: 'node', write: false,
  external: ['vue', 'pinia'], logLevel: 'silent',
  plugins: [{
    name: 'settings-services',
    setup(b) {
      b.onResolve({ filter: /^~\/composables\/use(AuthService|Api)$/ }, ({ path }) => ({
        path, namespace: 'settings-service',
      }));
      b.onLoad({ filter: /.*/, namespace: 'settings-service' }, ({ path }) => ({
        contents: path.endsWith('useApi')
          ? 'exports.useApi = () => globalThis.__readingRecovery.api;'
          : 'exports.useAuthService = () => globalThis.__readingRecovery.auth;',
      }));
      b.onResolve({ filter: /^~\// }, ({ path }) => ({
        path: fileURLToPath(new URL(`../../app/${path.slice(2)}.ts`, import.meta.url)),
      }));
    },
  }],
});
const loaded = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, loaded, loaded.exports);
const { useReadingSettingsStore } = loaded.exports;

export function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = new Map();
  const patches = [];
  const server = {
    theme: 'light', font_family: 'noto-serif', font_size: 18, font_weight: 'normal',
    line_height: 1.8, text_align: 'left', verse_joining: false, show_verse_numbers: true,
    tongdok_auto_complete: false, audio_playback_rate: 1, show_description: true,
    show_cross_ref: true, highlight_names: true, show_footnotes: false,
  };
  runtime.auth = { user: ref({ id: 7 }), isAuthenticated: ref(true) };
  runtime.api = {
    GET: async () => ({ data: { success: true, data: { settings: { ...server } } } }),
    PATCH: async (_path, body) => {
      patches.push(body);
      Object.assign(server, body);
      return { success: true };
    },
  };
  const globals = {
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
    document: { documentElement: { setAttribute() {} }, querySelector: () => null },
  };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, {
    value, configurable: true, writable: true,
  });
  const piniaInstances = [];
  const fresh = () => {
    const pinia = createPinia();
    piniaInstances.push(pinia);
    setActivePinia(pinia);
    return useReadingSettingsStore();
  };
  t.after(() => {
    for (const pinia of piniaInstances) pinia._s.clear();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { storage, patches, server, fresh };
}
