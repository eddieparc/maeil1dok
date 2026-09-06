import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as Router from 'vue-router';
import * as Icons from '@lucide/vue';

// Actual SFC scripts/templates and RouterLink; only service boundaries/header are doubles.
// This in-memory host does not claim CSS layout, native inert enforcement or visual proof.
const runtime = { Vue, Router, Icons, user: Vue.ref(null), notifications: Vue.reactive({ unreadCount: 0 }) };
globalThis.__navigationTest = runtime;
globalThis.useRoute = Router.useRoute;
const root = fileURLToPath(new URL('../', import.meta.url));
const exportsFor = (name, values) => Object.keys(values)
  .filter(key => key !== 'default' && /^[\w$]+$/.test(key))
  .map(key => `export const ${key} = globalThis.__navigationTest.${name}.${key};`).join('\n');

async function loadComponent(path) {
  const result = await build({
    stdin: { contents: `export { default } from '${path}';`, resolveDir: root },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    plugins: [{ name: 'navigation-sfc-runtime', setup(builder) {
      builder.onResolve({ filter: /^(vue|vue-router|@lucide\/vue)$/ }, ({ path }) => ({ path, namespace: 'runtime' }));
      builder.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => ({
        contents: path === 'vue' ? exportsFor('Vue', Vue) : path === 'vue-router' ? exportsFor('Router', Router) : exportsFor('Icons', Icons),
      }));
      builder.onResolve({ filter: /^~\/(composables\/useAuthService|stores\/notifications)$/ }, ({ path }) => ({ path, namespace: 'service' }));
      builder.onLoad({ filter: /.*/, namespace: 'service' }, ({ path }) => ({ contents: path.includes('useAuthService')
        ? 'export const useAuthService = () => ({ user: globalThis.__navigationTest.user });'
        : 'export const useNotificationsStore = () => globalThis.__navigationTest.notifications;',
      }));
      builder.onResolve({ filter: /^~\/.*\.vue$/ }, ({ path }) => ({ path: `${root}/app/${path.slice(2)}`, namespace: 'sfc' }));
      builder.onLoad({ filter: /\.vue$/, namespace: 'sfc' }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true }).content, loader: 'ts', resolveDir: root };
      });
    } }],
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default;
}
const [BottomNavigation, FloatingNav, FloatingBottomBar, PageLayout, SidebarNav] = await Promise.all([
  '~/components/BottomNavigation.vue', '~/components/home-v2/FloatingNav.vue',
  '~/components/common/FloatingBottomBar.vue', '~/components/common/PageLayout.vue', '~/components/common/SidebarNav.vue',
].map(loadComponent));

const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null });
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (target, text) => { target.text = text; },
  setElementText: (target, text) => { target.text = text; target.children = []; },
  parentNode: target => target.parent,
  nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp: (target, key, _previous, value) => { target.props[key] = value; },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1);
    target.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target);
  },
  remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null; },
});
const findAll = (target, predicate) => [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => findAll(child, predicate))];
const hasClass = (target, name) => String(target.props.class ?? '').split(/\s+/).includes(name);
const byClass = (target, name) => findAll(target, child => hasClass(child, name));
const links = target => findAll(target, child => child.type === 'a');
const tabs = target => byClass(target, 'bottom-nav').flatMap(links);
const tabbar = target => byClass(target, 'bottom-nav-container')[0];
const routes = target => tabs(target).map(link => link.props.href);

async function mount(component, initialProps = {}, slots = {}, path = '/') {
  runtime.user.value = null;
  runtime.notifications.unreadCount = 0;
  const router = Router.createRouter({ history: Router.createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] });
  await router.push(path); await router.isReady();
  const props = Vue.reactive(initialProps);
  const host = node('root');
  const app = renderer.createApp({ render: () => Vue.h(component, props, slots) });
  app.use(router);
  app.component('NuxtLink', Router.RouterLink);
  app.component('PageHeader', Vue.defineComponent({
    props: ['title', 'fallbackPath', 'showBack', 'onBack'],
    setup(header, { slots }) { return () => Vue.h('header', { ...header }, slots.right?.() ?? Vue.h('a', { href: '/notifications' })); },
  }));
  app.mount(host);
  return { host, props, router, close: () => app.unmount() };
}
function click(target, overrides = {}) {
  const event = { button: 0, defaultPrevented: false, currentTarget: { getAttribute: key => target.props[key] ?? null }, preventDefault() { this.defaultPrevented = true; }, ...overrides };
  const invoke = handler => { for (const fn of [handler].flat()) if (fn) fn(event); };
  const ancestors = [];
  for (let current = target; current; current = current.parent) ancestors.push(current);
  for (const ancestor of ancestors.toReversed()) invoke(ancestor.props.onClickCapture);
  for (const ancestor of ancestors) invoke(ancestor.props.onClick);
  return event;
}
async function navigateWithClick(router, target, path) {
  // Subscribe before triggering real RouterLink; test timeout bounds the signal.
  let unsubscribe;
  const navigation = new Promise((resolve, reject) => {
    unsubscribe = router.afterEach((to, _from, failure) => {
      if (failure) reject(failure);
      else if (to.path !== path) reject(new Error(`Expected ${path}, received ${to.path}`));
      else resolve();
    });
  });
  try { click(target); await navigation; await Vue.nextTick(); }
  finally { unsubscribe(); }
}

test('shared tabs navigate with real RouterLink and track nested routes and auth changes', { timeout: 3000 }, async t => {
  const view = await mount(BottomNavigation); t.after(view.close);
  assert.deepEqual(routes(view.host), ['/', '/bible', '/plan', '/groups', '/login']);
  for (const path of ['/bible', '/plan', '/groups', '/login', '/']) {
    await navigateWithClick(view.router, tabs(view.host).find(link => link.props.href === path), path);
    assert.deepEqual(tabs(view.host).filter(link => link.props['aria-current'] === 'page').map(link => link.props.href), [path]);
  }
  for (const [path, active] of [['/bible/notes', '/bible'], ['/groups/17', '/groups'], ['/plans', undefined], ['/bible-other', undefined]]) {
    await view.router.push(path); await Vue.nextTick();
    assert.deepEqual(tabs(view.host).filter(link => link.props['aria-current'] === 'page').map(link => link.props.href), active ? [active] : []);
  }
  runtime.user.value = { id: 42 }; await Vue.nextTick();
  await navigateWithClick(view.router, tabs(view.host).at(-1), '/profile/42');
  await view.router.push('/profile/420'); await Vue.nextTick();
  assert.equal(tabs(view.host).at(-1).props['aria-current'], undefined);
  runtime.user.value = null; await Vue.nextTick();
  assert.equal(tabs(view.host).at(-1).props.href, '/login');
});

test('standard defaults and reader density update the rendered tabbar without replacing tabs', async t => {
  const view = await mount(BottomNavigation); t.after(view.close);
  const originalTabs = tabs(view.host);
  assert.equal(tabbar(view.host).props['data-density'], 'standard');
  view.props.density = 'reader'; await Vue.nextTick();
  assert.equal(tabbar(view.host).props['data-density'], 'reader');
  assert.deepEqual(tabs(view.host), originalTabs);
});

test('hidden tabs are inert/nonfocusable while above controls remain available', async t => {
  const view = await mount(BottomNavigation, {}, { above: () => Vue.h('button', { id: 'audio' }) }); t.after(view.close);
  view.props.hidden = true; await Vue.nextTick();
  const hidden = byClass(view.host, 'bottom-nav-tabs')[0];
  assert.ok(hidden);
  assert.equal(hidden.props.inert, true);
  assert.equal(hidden.props['aria-hidden'], true);
  assert.ok(hasClass(hidden, 'is-hidden'));
  assert.equal(tabs(view.host).length, 5);
  assert.ok(tabs(view.host).every(link => link.props.tabindex === -1));
  assert.equal(findAll(hidden, child => child.props.id === 'audio').length, 0);
  assert.equal(findAll(view.host, child => child.props.id === 'audio').length, 1);
  view.props.hidden = false; await Vue.nextTick();
  assert.equal(hidden.props.inert, false);
  assert.ok(!hidden.props['aria-hidden']);
  assert.ok(tabs(view.host).every(link => link.props.tabindex !== -1));
});

test('plan interception emits once without navigating and preserves ordinary/modified links', { timeout: 3000 }, async t => {
  let emitted = 0;
  const view = await mount(BottomNavigation, { onPlan: () => emitted++ }); t.after(view.close);
  const plan = () => tabs(view.host).find(link => link.props.href === '/plan');
  await navigateWithClick(view.router, plan(), '/plan'); assert.equal(emitted, 0);
  await view.router.push('/bible'); view.props.interceptPlan = true; await Vue.nextTick();
  const pushes = [];
  const push = view.router.push.bind(view.router);
  view.router.push = (...args) => { pushes.push(args); return push(...args); };
  const intercepted = click(plan()); await Vue.nextTick();
  assert.equal(pushes.length, 0, 'interception must not even start asynchronous navigation');
  assert.equal(emitted, 1);
  assert.equal(intercepted.defaultPrevented, true);
  assert.equal(view.router.currentRoute.value.path, '/bible');
  assert.equal(plan().props.href, '/plan');
  for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) assert.equal(click(plan(), modifiers).defaultPrevented, false);
  assert.equal(emitted, 1);
  assert.equal(pushes.length, 0, 'modified links leave native new-tab/window handling intact');
  await navigateWithClick(view.router, tabs(view.host)[3], '/groups');
  view.props.interceptPlan = false; await Vue.nextTick();
  await navigateWithClick(view.router, plan(), '/plan');
});

test('legacy FloatingBottomBar composes one shared tabbar and preserves interactive named slots', { timeout: 3000 }, async t => {
  const calls = [];
  const action = id => () => Vue.h('button', { id, onClick: () => calls.push(id) });
  const view = await mount(FloatingBottomBar, {}, { above: action('audio'), popover: action('selection'), center: action('chapter') }); t.after(view.close);
  assert.equal(byClass(view.host, 'bottom-nav-container').length, 1);
  assert.equal(byClass(view.host, 'sidebar-nav').length, 1, 'standalone legacy reader retains desktop navigation');
  assert.equal(findAll(view.host, child => child.type === 'nav').length, 2, 'only shared mobile and desktop navigation landmarks');
  assert.deepEqual(routes(view.host), ['/', '/bible', '/plan', '/groups', '/login']);
  assert.equal(tabbar(view.host).props['data-density'], 'reader');
  for (const id of ['audio', 'selection', 'chapter']) click(findAll(view.host, child => child.props.id === id)[0]);
  assert.deepEqual(calls, ['audio', 'selection', 'chapter']);
  assert.equal(byClass(view.host, 'floating-bottom-navigation').length, 1);
  assert.equal(byClass(view.host, 'floating-above-popover').length, 1);
  await navigateWithClick(view.router, tabs(view.host)[1], '/bible');
});

test('home FloatingNav forwards density, hidden and plan API without another tabbar', async t => {
  let plans = 0;
  const view = await mount(FloatingNav, { density: 'reader', hidden: true, interceptPlan: true, onPlan: () => plans++ }); t.after(view.close);
  assert.equal(byClass(view.host, 'bottom-nav-container').length, 1);
  assert.equal(tabbar(view.host).props['data-density'], 'reader');
  assert.equal(byClass(view.host, 'bottom-nav-tabs')[0].props.inert, true);
  view.props.hidden = false; await Vue.nextTick(); click(tabs(view.host)[2]); assert.equal(plans, 1);
});

test('PageLayout retains header/slots/opt-out and forwards reader navigation inputs', async t => {
  let plans = 0;
  const onBack = () => {};
  const view = await mount(PageLayout, { title: 'Test', showBackButton: false, fallbackPath: '/groups', onBack, scrollAreaClass: 'consumer-scroll' }, {
    default: () => Vue.h('main', { id: 'content' }), 'header-action': () => Vue.h('button', { id: 'header-action' }),
  }); t.after(view.close);
  const header = findAll(view.host, child => child.type === 'header')[0];
  assert.equal(header.props.title, 'Test'); assert.equal(header.props.showBack, false);
  assert.equal(header.props.fallbackPath, '/groups'); assert.equal(header.props.onBack, onBack);
  assert.equal(findAll(header, child => child.props.id === 'header-action').length, 1);
  assert.equal(byClass(view.host, 'consumer-scroll').length, 1);
  assert.equal(findAll(view.host, child => child.props.id === 'content').length, 1);
  assert.equal(byClass(view.host, 'sidebar-nav').length, 1);
  assert.equal(byClass(view.host, 'bottom-nav-container').length, 1);
  Object.assign(view.props, { density: 'reader', hidden: true, interceptPlan: true, onPlan: () => plans++ }); await Vue.nextTick();
  assert.equal(tabbar(view.host).props['data-density'], 'reader');
  assert.equal(byClass(view.host, 'bottom-nav-tabs')[0].props.inert, true);
  view.props.hidden = false; await Vue.nextTick(); click(tabs(view.host)[2]); assert.equal(plans, 1);
  view.props.showFloatingNav = false; await Vue.nextTick();
  assert.equal(byClass(view.host, 'bottom-nav-container').length, 0);
  assert.equal(byClass(view.host, 'with-floating-nav').length, 0);
  assert.equal(byClass(view.host, 'sidebar-nav').length, 1);
});

test('desktop sidebar retains documented destinations, reactive profile, badge and active route', { timeout: 3000 }, async t => {
  const view = await mount(SidebarNav, {}, {}, '/groups/12'); t.after(view.close);
  const menu = byClass(view.host, 'sidebar-menu')[0];
  assert.deepEqual(links(menu).map(link => link.props.href), ['/', '/bible', '/plan', '/hasena', '/groups', '/intro']);
  assert.equal(links(menu).find(link => link.props['aria-current'] === 'page').props.href, '/groups');
  runtime.user.value = { id: 19, nickname: 'member' }; runtime.notifications.unreadCount = 3; await Vue.nextTick();
  assert.equal(byClass(view.host, 'notification-count')[0].text, '3');
  await navigateWithClick(view.router, byClass(view.host, 'sidebar-profile')[0], '/profile/19');
  assert.equal(byClass(view.host, 'sidebar-profile')[0].props['aria-current'], 'page');
});
