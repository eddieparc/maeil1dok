import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';

const runtime = { Vue };
globalThis.__homeSummaryTest = runtime;
globalThis.useState = () => Vue.ref('2026-09-18');
const { descriptor } = parse(await readFile(new URL('../app/components/home-v2/HomeDashboard.vue', import.meta.url), 'utf8'));
const script = compileScript(descriptor, { id: 'home-summary' }).content;
const modules = {
  vue: Object.keys(Vue).filter(key => /^[\w$]+$/.test(key))
    .map(key => `export const ${key} = globalThis.__homeSummaryTest.Vue.${key};`).join('\n'),
  '~/composables/useApi': 'export const useApi = () => globalThis.__homeSummaryTest.api;',
  '~/composables/useLandingAuthState': 'export const useLandingAuthState = () => ({ auth: globalThis.__homeSummaryTest.auth });',
  '~/composables/usePlanApi': 'export const usePlanApi = () => ({ fetchUserPlans: async () => globalThis.__homeSummaryTest.plans });',
  '~/composables/useScheduleFormatter': 'export const useScheduleFormatter = () => ({ getBookCode: () => "gen" });',
  '@lucide/vue': 'export const FlameIcon = {}, CalendarCheckIcon = {}, BookOpenIcon = {}, CheckIcon = {};',
};
const compiled = await build({
  stdin: { contents: script, loader: 'ts' }, bundle: true, write: false, format: 'esm',
  plugins: [{ name: 'home-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path }) => ({ path, namespace: 'boundary' }));
    builder.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => {
      if (path.endsWith('.vue')) return { contents: 'export default {};' };
      assert.ok(modules[path], `known boundary: ${path}`);
      return { contents: modules[path] };
    });
  } }],
});
const { default: Dashboard } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const renderer = Vue.createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null,
});

test('home only requests stats for subscriptions whose parent plans are active', { timeout: 5000 }, async () => {
  // Given an active subscription to an inactive parent and one current active plan.
  const calls = [];
  runtime.auth = { isAuthenticated: Vue.ref(true), user: Vue.ref({ id: 7 }) };
  runtime.plans = { available_plans: [], subscriptions: [
    { id: 1, plan_id: 1, plan_name: 'Historical plan', is_active: true, plan_is_active: false, is_default: true },
    { id: 2, plan_id: 2, plan_name: 'Current plan', is_active: true, plan_is_active: true, is_default: false },
  ] };
  runtime.api = {
    path: (template, params) => template.replace('{user_id}', String(params.user_id)),
    GET: async (path, options) => {
      calls.push(path);
      if (path.includes('/calendar/')) return { data: { success: true, data: { calendar: [] } } };
      if (path.includes('/profile/')) return { data: { success: true, data: { profile: { current_streak: 4 } } } };
      if (path === '/api/v1/todos/stats/progress/') return { data: {
        success: true, user_progress: 42,
        end_date: '2026-09-19',
      } };
      // A faithful old schedules response lets the baseline finish, not fail
      // accidentally from a missing API fixture.
      if (path === '/api/v1/todos/schedules/') return { data: [{ date: '2026-09-19' }] };
      throw new Error(`Unexpected API: ${path}`);
    },
  };
  let state;
  const app = renderer.createApp({
    setup() {
      state = Dashboard.setup({}, { expose() {} });
      return () => Vue.h('div');
    },
  });
  // When the actual component's mounted watcher loads the dashboard.
  app.mount({});
  let stop;
  try {
    await new Promise(resolve => {
      stop = Vue.watch(state.loading, value => { if (!value) resolve(); }, { immediate: true });
    });
    // Then the inactive parent's stats are never requested and the current card renders.
    assert.equal(state.error.value, '');
    assert.equal(state.planCards.value.length, 1);
    assert.deepEqual(state.planCards.value.map(card => [card.planId, card.planName, card.progress]), [[2, 'Current plan', 42]]);
    assert.equal(state.remainingDays.value, 1);
    assert.deepEqual(calls.filter(path => path === '/api/v1/todos/stats/progress/'), ['/api/v1/todos/stats/progress/']);
    assert.equal(calls.filter(path => path === '/api/v1/todos/schedules/').length, 0);
  } finally {
    stop?.();
    app.unmount();
  }
});
