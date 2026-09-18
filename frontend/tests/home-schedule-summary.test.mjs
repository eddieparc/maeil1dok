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

test('home derives each card and remaining days from progress without downloading schedules', { timeout: 5000 }, async () => {
  // Given three active plans with distinct end dates and progress values.
  const calls = [];
  runtime.auth = { isAuthenticated: Vue.ref(true), user: Vue.ref({ id: 7 }) };
  runtime.plans = { available_plans: [], subscriptions: [1, 2, 3].map(id => ({
    id, plan_id: id, plan_name: `Plan ${id}`, is_active: true, is_default: id === 1,
  })) };
  runtime.api = {
    path: (template, params) => template.replace('{user_id}', String(params.user_id)),
    GET: async (path, options) => {
      calls.push(path);
      if (path.includes('/calendar/')) return { data: { success: true, data: { calendar: [] } } };
      if (path.includes('/profile/')) return { data: { success: true, data: { profile: { current_streak: 4 } } } };
      if (path === '/api/v1/todos/stats/progress/') return { data: {
        success: true, user_progress: options.params.plan_id * 12,
        end_date: `2026-09-${24 + options.params.plan_id}`,
      } };
      // A faithful old schedules response lets the baseline finish, not fail
      // accidentally from a missing API fixture.
      if (path === '/api/v1/todos/schedules/') return { data: [{ date: `2026-09-${24 + options.params.plan_id}` }] };
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
    // Then the displayed values are correct with one small response per plan.
    assert.equal(state.error.value, '');
    assert.equal(state.remainingDays.value, 7);
    assert.deepEqual(state.planCards.value.map(card => [card.progress, card.remainingDays]), [[12, 7], [24, 8], [36, 9]]);
    assert.equal(calls.filter(path => path === '/api/v1/todos/stats/progress/').length, 3);
    assert.equal(calls.filter(path => path === '/api/v1/todos/schedules/').length, 0);
  } finally {
    stop?.();
    app.unmount();
  }
});
