import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transform } from 'esbuild';
import * as Vue from 'vue';
import compilerSfc from '@vue/compiler-sfc';

const source = await readFile(
  new URL('../app/components/BibleScheduleContent.vue', import.meta.url),
  'utf8',
);

const { compileScript, parse: parseSfc } = compilerSfc;
const descriptor = parseSfc(source, { filename: 'BibleScheduleContent.vue' }).descriptor;
const script = compileScript(descriptor, { id: 'bible-schedule-content-test' });
const templateAst = descriptor.template?.ast;

const executable = await transform(script.content, { loader: 'ts', format: 'cjs', define: { 'import.meta.client': 'false' } });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function runtime(t) {
  const auth = { isInitialized: Vue.ref(false), isSessionUnknown: Vue.ref(false), isAuthenticated: Vue.ref(true), user: Vue.ref({ id: 7 }) };
  const store = Vue.reactive({ selectedPlanId: 1, initializeFromStorage() {}, setSelectedPlanId(id) { this.selectedPlanId = id; } });
  const subscriptions = [], months = [], unmount = [];
  const module = { exports: {} };
  const scope = Vue.effectScope();
  const api = {
    useAuthService: () => auth,
    useAuthGuard: () => ({}),
    useSelectedPlanStore: () => store,
    usePlanApi: () => ({ fetchSubscriptions() { const request = deferred(); subscriptions.push(request); return request.promise; } }),
    useScheduleApi: () => ({ fetchMonthlySchedules(plan, month) { const request = { ...deferred(), plan, month }; months.push(request); return request.promise; } }),
    useModal: () => ({}), useToast: () => ({}),
    useScrollToElement: () => ({ setScrollContainer() {} }),
  };
  new Function('require', 'module', 'exports', executable.code)(name => {
    if (name === 'vue') return { ...Vue, onMounted() {}, onBeforeUnmount: callback => unmount.push(callback) };
    if (name === 'vue-router') return { useRoute: () => ({ query: {} }), useRouter: () => ({}) };
    if (name.includes('/composables/') || name.includes('/stores/')) return api;
    if (name.endsWith('/types/plan')) return { DEFAULT_BULK_EDIT_STATE: {} };
    return {};
  }, module, module.exports);
  const state = scope.run(() => module.exports.default.setup({}, { expose() {}, emit() {} }));
  state.mounted.value = true;
  t.after(() => { for (const callback of unmount) callback(); scope.stop(); });
  return { state, auth, store, subscriptions, months, unmount };
}

for (const failure of [new TypeError('offline'), Object.assign(new Error('rate limited'), { status: 429 })]) {
  test(`loading settles when subscription rejects with ${failure.message}`, { timeout: 3000 }, async t => {
    // Given an unresolved identity followed by an authenticated identity.
    const view = runtime(t);
    assert.equal(view.subscriptions.length, 0);
    view.auth.isInitialized.value = true;
    const pending = view.state.initialize();
    // When the current subscription request rejects.
    view.subscriptions.at(-1).reject(failure);
    await pending;
    // Then failure owns the terminal state, not empty or loading.
    assert.equal(view.state.loading.value, false);
    assert.notEqual(view.state.loadError.value, '');
    assert.equal(view.store.selectedPlanId, 1);
  });
}

test('obsolete monthly rejection cannot clear newer loading and retry settles empty', { timeout: 3000 }, async t => {
  // Given two overlapping month requests.
  const { state, months } = runtime(t);
  const old = state.fetchSchedules();
  state.selectedMonth.value = state.selectedMonth.value === 12 ? 1 : 12;
  const current = state.fetchSchedules();
  // When the old request rejects before the current request.
  months[0].reject(new TypeError('old offline'));
  await old;
  assert.equal(state.loading.value, true);
  assert.equal(state.loadError.value, '');
  months[1].reject(Object.assign(new Error('rate limited'), { status: 429 }));
  await current;
  assert.equal(state.loading.value, false);
  assert.notEqual(state.loadError.value, '');
  const retry = state.fetchSchedules();
  months[2].resolve([]);
  await retry;
  // Then the retry is valid empty with no stale error or loading ownership.
  assert.equal(state.loading.value, false);
  assert.equal(state.loadError.value, '');
  assert.deepEqual(state.schedules.value, []);
});

test('unknown identity settles without guest reads and unmount discards late data', { timeout: 3000 }, async t => {
  // Given an unknown session, not a confirmed guest.
  const { state, auth, months, subscriptions, unmount } = runtime(t);
  auth.isSessionUnknown.value = true;
  await state.initialize();
  assert.equal(state.loading.value, false);
  assert.notEqual(state.loadError.value, '');
  assert.equal(subscriptions.length, 0);
  const pending = state.fetchSchedules();
  // When the component unmounts before the pending month resolves.
  for (const callback of unmount) callback();
  months[0].resolve([{ id: 91 }]);
  await pending;
  // Then no obsolete data is applied to the removed instance.
  assert.deepEqual(state.schedules.value, []);
});

const walkTemplate = (node, visitor) => {
  visitor(node);
  for (const child of node.children ?? []) {
    walkTemplate(child, visitor);
  }
};

const hasStaticClass = (node, className) =>
  node.props.some(prop =>
    prop.type === 6 &&
    prop.name === 'class' &&
    prop.value?.content.split(/\s+/).includes(className)
  );

const getDirectiveExpression = (node, name) => {
  const directive = node.props.find(prop => prop.type === 7 && prop.name === name);
  return directive?.exp?.content ?? '';
};

const collectRootIdentifiers = (expression) => {
  const rootIdentifiers = new Set();
  const identifierPattern = /(?<![.\w$])([A-Za-z_$][\w$]*)/g;
  const jsKeywords = new Set(['false', 'null', 'true', 'undefined']);

  for (const match of expression.matchAll(identifierPattern)) {
    const identifier = match[1];
    if (!jsKeywords.has(identifier)) {
      rootIdentifiers.add(identifier);
    }
  }

  return [...rootIdentifiers];
};

test('default plan message condition only references declared setup bindings', () => {
  const defaultPlanIndicators = [];

  walkTemplate(templateAst, (node) => {
    if (node.type === 1 && hasStaticClass(node, 'default-plan-indicator')) {
      defaultPlanIndicators.push(node);
    }
  });

  assert.equal(defaultPlanIndicators.length, 1);

  const condition = getDirectiveExpression(defaultPlanIndicators[0], 'if');
  assert.notEqual(condition, '');

  const unknownIdentifiers = collectRootIdentifiers(condition).filter(
    identifier => !script.bindings[identifier],
  );

  assert.deepEqual(unknownIdentifiers, []);
});
