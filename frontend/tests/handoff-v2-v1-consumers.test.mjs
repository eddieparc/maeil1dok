import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as Router from 'vue-router';
import * as Pinia from 'pinia';
import * as Icons from '@lucide/vue';

// Compiled production setup/templates + real stores/controls/router. Only Nuxt,
// API/profile-data boundaries and the renderer platform are supplied; no CSS proof.
const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = { Vue, Router, Pinia, Icons };
globalThis.__v1Consumers = runtime;
for (const name of ['ref', 'computed', 'watch', 'onMounted', 'onUnmounted', 'onBeforeUnmount', 'nextTick']) globalThis[name] = Vue[name];
globalThis.useHead = () => {};
globalThis.useRoute = Router.useRoute;
globalThis.navigateTo = path => runtime.router.push(path);
const exportsFor = name => Object.keys(runtime[name]).filter(key => key !== 'default' && /^[\w$]+$/.test(key))
  .map(key => `export const ${key} = globalThis.__v1Consumers.${name}.${key};`).join('\n');
const service = {
  '~/composables/useApi': 'export const useApi = () => globalThis.__v1Consumers.api;',
  '~/composables/useAuthService': 'export const useAuthService = () => globalThis.__v1Consumers.auth;',
  '~/composables/useProfilePageData': 'export const useProfilePageData = () => globalThis.__v1Consumers.profileData;',
  '~/composables/useModal': 'export const useModal = () => globalThis.__v1Consumers.modal;',
  '~/composables/useToast': 'export const useToast = () => globalThis.__v1Consumers.toast;',
  '~/utils/devicePushRuntime': `export const isDevicePushSupported = () => false;
    export const readBrowserPushState = async () => ({});
    export const subscribeCurrentDevice = async () => {};
    export const unsubscribeCurrentDevice = async () => {};`,
};
async function load(path, store = false) {
  const result = await build({
    stdin: { contents: store ? `export * from '${path}';` : `export { default } from '${path}';`, resolveDir: root },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    plugins: [{ name: 'v1-consumer-runtime', setup(builder) {
      builder.onResolve({ filter: /^(vue|vue-router|pinia|@lucide\/vue)$/ }, ({ path }) => ({ path, namespace: 'runtime' }));
      builder.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => ({ contents: exportsFor({ vue: 'Vue', 'vue-router': 'Router', pinia: 'Pinia', '@lucide/vue': 'Icons' }[path]) }));
      builder.onResolve({ filter: /^#components$/ }, () => ({ path: '#components', namespace: 'nuxt-components' }));
      builder.onLoad({ filter: /.*/, namespace: 'nuxt-components' }, () => ({ contents: 'export const NuxtLink = globalThis.__v1Consumers.Router.RouterLink;' }));
      builder.onResolve({ filter: /^~\// }, ({ path }) => service[path]
        ? { path, namespace: 'service' }
        : { path: `${root}/app/${path.slice(2)}${path.endsWith('.vue') ? '' : '.ts'}` });
      builder.onLoad({ filter: /.*/, namespace: 'service' }, ({ path }) => ({ contents: service[path] }));
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        if (path.endsWith('/PageLayout.vue')) return { contents: `import { h } from 'vue'; export default { setup(_, { slots }) { return () => h('main', [slots['header-action']?.(), slots.default?.()]); } };` };
        if (path.endsWith('/BottomSheet.vue')) return { contents: `import { h } from 'vue'; export default { props: ['modelValue'], setup(props, { slots }) { return () => props.modelValue ? h('section', slots.default?.()) : null; } };` };
        if (/\/(GroupPlanCalendar|FollowersModal|FollowingModal|ProfileEditModal|ScheduleDetailModal)\.vue$/.test(path)) return { contents: 'export default () => null;' };
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: fileURLToPath(new URL('.', `file://${path}`)) };
      });
    } }],
  });
  const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  return store ? module : module.default;
}
const [Profile, Achievements, Scoreboard, Notifications, GroupDetail, groupModule, scoreboardModule, notificationModule] = await Promise.all([
  '~/pages/profile/[id].vue', '~/components/profile/ProfileAchievements.vue', '~/pages/scoreboard.vue', '~/pages/notifications/index.vue',
  '~/pages/groups/[id].vue', '~/stores/groups', '~/stores/scoreboard', '~/stores/notifications',
].map((path, index) => load(path, index >= 5)));

const node = (type, text = '') => Vue.markRaw({ type, text, props: {}, children: [], parent: null,
  focus() { runtime.focused = this; },
  listeners: {},
  addEventListener(name, handler) { (this.listeners[name] ??= []).push(handler); },
  removeEventListener(name, handler) { this.listeners[name] = this.listeners[name]?.filter(item => item !== handler); },
  get tagName() { return this.type.toUpperCase(); },
  get options() { return this.children.filter(child => child.type === 'option'); },
  get parentElement() { return this.parent; },
  querySelectorAll(selector) { assert.equal(selector, '[role="tab"]'); return findAll(this, child => child.props.role === 'tab'); },
});
const notifyRender = () => { for (const listener of runtime.renderListeners) listener(runtime.renderRoot); };
const hostChanged = () => Vue.queuePostFlushCb(notifyRender);
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (target, text) => { target.text = text; hostChanged(); },
  setElementText: (target, text) => { target.text = text; target.children = []; hostChanged(); },
  parentNode: target => target.parent,
  nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp: (target, key, _previous, value) => { target.props[key] = value; if (key === 'value') target.value = value; hostChanged(); },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1);
    target.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target); hostChanged();
  },
  remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null; hostChanged(); },
});
const findAll = (target, predicate) => [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => findAll(child, predicate))];
const byClass = (target, name) => findAll(target, child => String(child.props.class ?? '').split(/\s+/).includes(name));
const byId = (target, id) => findAll(target, child => child.props.id === id)[0];
const text = target => target.text + target.children.map(text).join('');
function click(target) {
  assert.ok(target, 'click target exists');
  assert.ok(!target.props.disabled, 'click target is enabled');
  const event = { button: 0, defaultPrevented: false, currentTarget: target, target,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, };
  for (const handler of [target.props.onClick].flat()) handler?.(event);
}
function key(target, value) {
  assert.ok(target.props.onKeydown, 'tabs handle keyboard activation');
  const event = { key: value, currentTarget: target, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  target.props.onKeydown(event); return event;
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function actionSignal(store, name) {
  const signal = deferred();
  const unsubscribe = store.$onAction(({ name: action, after, onError }) => {
    if (action !== name) return;
    unsubscribe(); after(signal.resolve); onError(signal.reject);
  });
  return signal.promise;
}
function renderSignal(predicate) {
  const signal = deferred();
  const listener = host => { if (predicate(host)) { runtime.renderListeners.delete(listener); signal.resolve(); } };
  runtime.renderListeners.add(listener); return signal.promise;
}
const ownGroup = { id: 17, name: 'Group 17', description: '', creator: { id: 7, nickname: 'Reader' }, plans: [], member_count: 2, max_members: 10, is_public: true, is_member: true, show_in_profile: true };
const entry = { rank: 2, user: { id: 8, nickname: 'Member 8', is_me: false }, completed_days: 6, bible_completed_days: 6, hasena_completed_days: 3, activity_score: 9, progress_rate: 42, current_streak: 4, longest_streak: 8 };
async function setup() {
  const pinia = Pinia.createPinia(); Pinia.setActivePinia(pinia);
  runtime.auth = {
    user: Vue.ref({ id: 7 }),
    isAuthenticated: Vue.ref(true),
    initialize: async () => {},
  };
  runtime.calls = []; runtime.focused = null; runtime.renderListeners = new Set();
  runtime.toast = { success: () => {}, error: () => {} };
  runtime.api = {
    path: (path, params) => path.replace(/\{(\w+)\}/g, (_, key) => params[key]),
    GET: async (path, options) => {
      runtime.calls.push([path, options?.params]);
      if (path === '/api/v1/todos/groups/') return { data: { success: true, groups: [structuredClone(ownGroup)] } };
      if (path === '/api/v1/todos/scoreboard/my-ranking/') return { data: { success: true, ranking: { ...entry, rank: null, total_users: 0, percentile: 0 } } };
      return { data: { success: true, leaderboard: [], notifications: [], unread_count: 0 } };
    },
    PATCH: async (_path, payload) => ({ success: true, ...payload }),
    POST: async () => ({ success: true }),
  };
  const groups = groupModule.useGroupsStore();
  const scoreboard = scoreboardModule.useScoreboardStore();
  const notifications = notificationModule.useNotificationsStore();
  runtime.profileLoads = [];
  runtime.profileData = {
    loadingStates: Vue.reactive({ profile: false, calendar: false, achievements: false, groups: false }),
    errors: Vue.ref([]), profile: Vue.ref({ user: { id: 7, nickname: 'Reader' }, joined_date: '2026-01-01', total_completed_days: 12, current_streak: 4, longest_streak: 8, followers_count: 1, following_count: 2 }),
    calendarData: Vue.ref([]), calendarPlans: Vue.ref([]), achievements: Vue.ref([]),
    groups: Vue.computed(() => groups.myGroups), followers: Vue.ref([]), following: Vue.ref([]),
    isOwnProfile: Vue.ref(true), completionRate: Vue.ref(42),
    loadInitialData: () => { runtime.profileLoads.push('initial'); },
    loadTabData: tab => { runtime.profileLoads.push(tab); },
    loadFollowers: () => {}, loadFollowing: () => {}, handleMonthChange: () => {}, toggleFollow: () => {}, handleToggleFollowInModal: () => {}, handleUnfollowInModal: () => {}, cleanup: () => {},
  };
  runtime.router = Router.createRouter({ history: Router.createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] });
  await runtime.router.push('/profile/7'); await runtime.router.isReady();
  return { pinia, groups, scoreboard, notifications };
}
function mount(component, env, props = {}) {
  const host = node('root'); const reactiveProps = Vue.reactive(props);
  runtime.renderRoot = host;
  const app = renderer.createApp({ render: () => Vue.h(component, reactiveProps) });
  app.use(env.pinia); app.use(runtime.router); app.component('NuxtLink', Router.RouterLink);
  app.component('NuxtImg', { setup(_, { attrs }) { return () => Vue.h('img', attrs); } });
  globalThis.document = { getElementById: id => byId(host, id) };
  app.mount(host); return { host, props: reactiveProps, close: () => app.unmount() };
}

test('profile tabs use roving keyboard focus and retain lazy tab loading', { timeout: 5000 }, async t => {
  const env = await setup(); const view = mount(Profile, env); t.after(view.close);
  const tabs = () => byClass(view.host, 'tab-button');
  assert.deepEqual(tabs().map(tab => tab.props.tabindex), [0, -1, -1]);
  for (const [value, id] of [['ArrowRight', 'achievements'], ['End', 'groups'], ['ArrowRight', 'calendar'], ['ArrowLeft', 'groups'], ['Home', 'calendar']]) {
    const current = tabs().find(tab => tab.props['aria-selected']);
    assert.equal(key(current, value).defaultPrevented, true); await Vue.nextTick();
    const active = byId(view.host, `profile-tab-${id}`);
    assert.equal(active.props['aria-selected'], true); assert.equal(runtime.focused, active);
    assert.ok(byId(view.host, active.props['aria-controls']));
    assert.equal(runtime.profileLoads.at(-1), id);
    assert.equal(tabs().filter(tab => tab.props.tabindex === 0).length, 1);
  }
});

test('own profile forwards group ownership and visibility changes reach the real group store', { timeout: 5000 }, async t => {
  const env = await setup(); await env.groups.fetchGroups({ only_mine: true });
  const view = mount(Profile, env); t.after(view.close);
  click(byId(view.host, 'profile-tab-groups')); await Vue.nextTick();
  const toggle = byClass(view.host, 'visibility-toggle')[0];
  assert.ok(toggle, 'owner can manage profile visibility');
  const response = deferred(); const requests = [];
  runtime.api.PATCH = (path, payload) => { requests.push([path, payload]); return response.promise; };
  const saved = actionSignal(env.groups, 'updateGroupVisibility');
  click(toggle); assert.equal(env.groups.myGroups[0].show_in_profile, true);
  assert.deepEqual(requests, [['/api/v1/todos/groups/17/visibility/', { show_in_profile: false }]]);
  response.resolve({ success: true, show_in_profile: false }); await saved; await Vue.nextTick();
  assert.equal(byClass(view.host, 'group-item').length, 0);
  click(byClass(view.host, 'hidden-groups-toggle')[0]); await Vue.nextTick();
  assert.equal(byClass(view.host, 'group-item').length, 1);
  runtime.profileData.isOwnProfile.value = false; await Vue.nextTick();
  assert.equal(byClass(view.host, 'visibility-toggle').length, 0);
  assert.equal(byClass(view.host, 'hidden-groups-section').length, 0);
});

test('profile error retry reloads the existing profile data boundary', { timeout: 5000 }, async t => {
  const env = await setup(); runtime.profileData.profile.value = null; runtime.profileData.errors.value = ['offline'];
  const view = mount(Profile, env); t.after(view.close);
  click(byClass(view.host, 'retry-button')[0]); assert.deepEqual(runtime.profileLoads, ['initial', 'initial']);
});

test('achievement tabs support keyboard selection and unavailable plan breakdowns cannot claim a filter', { timeout: 5000 }, async t => {
  const env = await setup();
  const achievement = type => ({ id: null, achievement_type: type, title: type, description: '', icon: 'book', order: 1, unlocked: false, unlockedAt: null, milestone_value: 3 });
  const view = mount(Achievements, env, { achievementsData: [achievement('reading_books'), achievement('hasena_streak')], plans: [{ id: 11, name: 'Plan 11' }] }); t.after(view.close);
  const plans = byClass(view.host, 'plan-tab');
  assert.equal(plans.length, 2); assert.equal(plans[1].props.disabled, true, 'API has no plan_id on achievements');
  assert.equal(plans[0].props['aria-selected'], true);
  const tabs = byClass(view.host, 'achievement-tab');
  assert.deepEqual(tabs.map(tab => tab.props.tabindex), [0, -1]);
  key(tabs[0], 'ArrowRight'); await Vue.nextTick();
  assert.equal(tabs[1].props['aria-selected'], true); assert.equal(runtime.focused, tabs[1]);
  assert.equal(byClass(view.host, 'achievement-card').length, 1);
  assert.equal(byClass(view.host, 'achievement-card')[0].props['aria-describedby'], 'achievement-hasena_streak');
  key(tabs[1], 'Home'); await Vue.nextTick(); assert.equal(tabs[0].props['aria-selected'], true);
});

test('scoreboard group view loads memberships and real group rankings with the selected period/month', { timeout: 5000 }, async t => {
  const env = await setup(); const initial = actionSignal(env.scoreboard, 'fetchGlobalLeaderboard');
  const view = mount(Scoreboard, env); t.after(view.close); await initial; await Vue.nextTick();
  const groupTab = byClass(view.host, 'segmented-control__option').find(tab => tab.props.id === 'scoreboard-view-group');
  assert.ok(groupTab, 'group ranking is a real selectable view');
  const ranked = actionSignal(env.scoreboard, 'fetchGroupLeaderboard');
  const response = deferred();
  const originalGet = runtime.api.GET;
  runtime.api.GET = (path, options) => {
    if (path.includes('/scoreboard/group/')) { runtime.calls.push([path, options.params]); return response.promise; }
    if (path === '/api/v1/todos/groups/') return Promise.resolve({ data: { success: true, groups: [ownGroup, { ...ownGroup, id: 19, name: 'Group 19' }] } });
    return originalGet(path, options);
  };
  const memberships = actionSignal(env.groups, 'fetchGroups');
  click(groupTab);
  await memberships; await Vue.nextTick();
  const ready = renderSignal(host => findAll(host, child => child.type === 'select' && !child.props.disabled).length > 0 && byClass(host, 'leaderboard-mobile-card').length > 0);
  response.resolve({ data: { success: true, leaderboard: [entry] } }); await ranked; await ready;
  assert.equal(env.scoreboard.currentGroupId, 17);
  assert.deepEqual(runtime.calls.find(([path]) => path.includes('/scoreboard/group/')), ['/api/v1/todos/scoreboard/group/17/', { period: 'month', month: env.scoreboard.selectedMonth }]);
  assert.equal(byClass(view.host, 'leaderboard-mobile-card').length, 1);
  assert.equal(text(byClass(view.host, 'days-count')[0]), '9');
  const groupSelect = findAll(view.host, child => child.type === 'select')[0]; assert.ok(groupSelect);
  const changedGroup = actionSignal(env.scoreboard, 'fetchGroupLeaderboard');
  for (const option of groupSelect.options) option.selected = option.value === 19;
  const event = { target: groupSelect };
  for (const listener of groupSelect.listeners.change) listener(event);
  groupSelect.props.onChange(event);
  await changedGroup; await Vue.nextTick();
  assert.equal(env.scoreboard.currentGroupId, 19);
  assert.equal(runtime.calls.filter(([path]) => path.includes('/scoreboard/group/')).at(-1)[0], '/api/v1/todos/scoreboard/group/19/');
  const reranked = actionSignal(env.scoreboard, 'fetchGroupLeaderboard');
  click(byClass(view.host, 'filter-chip')[0]); await reranked; await Vue.nextTick();
  assert.equal(env.scoreboard.currentPeriod, 'week');
  assert.deepEqual(runtime.calls.filter(([path]) => path.includes('/scoreboard/group/')).at(-1)[1], { period: 'week' });
});

test('scoreboard fetch failures render an actionable error rather than an empty ranking', { timeout: 5000 }, async t => {
  const env = await setup(); runtime.auth.isAuthenticated.value = false;
  runtime.api.GET = async () => { throw new Error('offline'); };
  const failedRender = renderSignal(host => findAll(host, child => child.props.role === 'alert').length > 0);
  const initial = actionSignal(env.scoreboard, 'fetchGlobalLeaderboard');
  const view = mount(Scoreboard, env); t.after(view.close); await initial; await Vue.nextTick();
  await failedRender;
  const error = findAll(view.host, child => child.props.role === 'alert')[0];
  assert.ok(error); assert.ok(text(error).includes('offline'));
  runtime.api.GET = async () => ({ data: { success: true, leaderboard: [entry] } });
  const retried = actionSignal(env.scoreboard, 'fetchGlobalLeaderboard');
  click(byClass(view.host, 'retry-button')[0]); await retried; await Vue.nextTick();
  assert.equal(findAll(view.host, child => child.props.role === 'alert').length, 0);
  assert.equal(byClass(view.host, 'leaderboard-mobile-card').length, 1);
});

test('scoreboard group membership loading distinguishes guest, empty and failed responses', { timeout: 5000 }, async t => {
  const env = await setup(); runtime.auth.isAuthenticated.value = false;
  const initial = actionSignal(env.scoreboard, 'fetchGlobalLeaderboard');
  const view = mount(Scoreboard, env); t.after(view.close); await initial; await Vue.nextTick();
  const guestRender = renderSignal(host => byClass(host, 'leaderboard-empty-panel').length > 0);
  click(byId(view.host, 'scoreboard-view-group')); await guestRender;
  assert.equal(runtime.calls.filter(([path]) => path === '/api/v1/todos/groups/').length, 0);
  assert.equal(findAll(view.host, child => child.type === 'select').length, 0);
  runtime.auth.isAuthenticated.value = true;
  click(byId(view.host, 'scoreboard-view-global')); await Vue.nextTick();
  const originalGet = runtime.api.GET;
  runtime.api.GET = (path, options) => path === '/api/v1/todos/groups/' ? Promise.reject(new Error('memberships offline')) : originalGet(path, options);
  const failure = renderSignal(host => findAll(host, child => child.props.role === 'alert').length > 0);
  click(byId(view.host, 'scoreboard-view-group')); await failure;
  assert.equal(env.groups.error, 'memberships offline');
  runtime.api.GET = (path, options) => path === '/api/v1/todos/groups/' ? Promise.resolve({ data: { success: true, groups: [] } }) : originalGet(path, options);
  const empty = renderSignal(host => byClass(host, 'leaderboard-empty-panel').length > 0 && findAll(host, child => child.props.role === 'alert').length === 0);
  click(byClass(view.host, 'retry-button')[0]); await empty;
  assert.equal(env.scoreboard.currentGroupId, null);
  assert.equal(findAll(view.host, child => child.type === 'select').length, 0);
  assert.equal(byClass(view.host, 'leaderboard-mobile-card').length, 0);
});

test('scoreboard preserves the distinct following relationship API and tab-panel connection', { timeout: 5000 }, async t => {
  const env = await setup(); const initial = actionSignal(env.scoreboard, 'fetchGlobalLeaderboard');
  const view = mount(Scoreboard, env); t.after(view.close); await initial; await Vue.nextTick();
  const followed = actionSignal(env.scoreboard, 'fetchFriendsLeaderboard');
  click(byId(view.host, 'scoreboard-view-following')); await followed; await Vue.nextTick();
  assert.deepEqual(runtime.calls.find(([path]) => path.endsWith('/scoreboard/friends/'))[1], { period: 'month', type: 'following', month: env.scoreboard.selectedMonth });
  assert.equal(byId(view.host, 'scoreboard-panel').props['aria-labelledby'], 'scoreboard-view-following');
  assert.equal(env.scoreboard.currentGroupId, null);
});

test('notifications retain live filtering, optimistic read state, target navigation and mark-all', { timeout: 5000 }, async t => {
  const env = await setup();
  const items = [1, 2].map(id => ({ id, type: 'reading_reminder', title: `Notice ${id}`, body: '', created_at: '2026-09-05T12:00:00Z', is_read: false, read_at: null, target_url: '/plan', data: {} }));
  runtime.api.GET = async () => ({ data: { success: true, notifications: structuredClone(items), unread_count: 2 } });
  const loaded = actionSignal(env.notifications, 'fetchInbox');
  const view = mount(Notifications, env); t.after(view.close); await loaded; await Vue.nextTick();
  assert.equal(byClass(view.host, 'notification-unread-dot').length, 2);
  const readResponse = deferred(); runtime.api.PATCH = () => readResponse.promise;
  const read = actionSignal(env.notifications, 'markAsRead');
  const navigated = deferred(); const unsubscribe = runtime.router.afterEach(to => navigated.resolve(to.path)); t.after(unsubscribe);
  click(byClass(view.host, 'notification-card')[0]);
  assert.equal(env.notifications.unreadCount, 1); assert.equal(await navigated.promise, '/plan');
  readResponse.resolve({ success: true }); await read; await Vue.nextTick();
  assert.equal(byClass(view.host, 'notification-unread-dot').length, 1);
  const allRead = actionSignal(env.notifications, 'markAllAsRead'); click(byClass(view.host, 'mark-all-button')[0]); await allRead; await Vue.nextTick();
  assert.equal(env.notifications.unreadCount, 0); assert.equal(byClass(view.host, 'notification-unread-dot').length, 0);
  runtime.api.GET = async () => ({ data: { success: true, notifications: env.notifications.notifications, unread_count: 0 } });
  const filtered = actionSignal(env.notifications, 'fetchInbox'); click(byClass(view.host, 'filter-chip')[1]); await filtered; await Vue.nextTick();
  assert.equal(byClass(view.host, 'notification-card').length, 0);
});


test('group leaving requests danger confirmation and only a confirmed choice reaches the live store', { timeout: 5000 }, async t => {
  const env = await setup(); await runtime.router.push('/groups/17');
  // Route params are supplied by the real router's explicit parameterized route.
  runtime.router.addRoute({ path: '/groups/:id', component: { render: () => null } });
  await runtime.router.replace('/groups/17');
  const requests = [];
  runtime.api.GET = async path => ({ data: path.endsWith('/members/')
    ? { success: true, members: [] }
    : { success: true, group: { ...ownGroup, my_role: '멤버' } } });
  runtime.api.POST = async path => { requests.push(path); return { success: true }; };
  let decision = deferred(); let asked = deferred();
  runtime.modal = { confirm: options => { asked.resolve(options); return decision.promise; }, alert: async () => {} };
  const loaded = renderSignal(host => byClass(host, 'group-cta').length > 0);
  const view = mount(GroupDetail, env); t.after(view.close); await loaded;
  click(byClass(view.host, 'more-button')[0]); await Vue.nextTick();
  click(byClass(view.host, 'app-button--danger')[0]);
  assert.equal((await asked.promise).confirmVariant, 'danger');
  assert.deepEqual(requests, []);
  decision.resolve(false); await decision.promise; await Vue.nextTick(); assert.deepEqual(requests, []);
  decision = deferred(); asked = deferred();
  click(byClass(view.host, 'more-button')[0]); await Vue.nextTick();
  const left = actionSignal(env.groups, 'leaveGroup');
  const navigated = deferred(); const unsubscribe = runtime.router.afterEach(to => navigated.resolve(to.path)); t.after(unsubscribe);
  click(byClass(view.host, 'app-button--danger')[0]); await asked.promise;
  decision.resolve(true); await left;
  assert.equal(await navigated.promise, '/groups');
  assert.deepEqual(requests, ['/api/v1/todos/groups/17/leave/']);
});
