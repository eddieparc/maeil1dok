import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { compare, selectorSpecificity } from '@csstools/selector-specificity';
import { is as matchesCss } from 'css-select';
import { Element as CssElement } from 'domhandler';
import { afterEach, test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, compileStyle, parse } from '@vue/compiler-sfc';

const require = createRequire(import.meta.url);
const Vue = require('vue');
const appDir = fileURLToPath(new URL('../app/', import.meta.url));
const sourcePath = resolve(appDir, 'components/admin/AdminVideoIntroContent.vue');
const events = new EventEmitter();
const compiledStyles = new Map();
let runtime, auth, api, modal, toast, documentBody;

async function loadPage() {
  if (runtime) return runtime;
  const result = await build({
    entryPoints: [resolve(appDir, 'pages/admin/video/intro.vue')],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    define: { 'import.meta.client': 'true', 'import.meta.server': 'false' },
    external: ['vue', '@lucide/vue', '#components'],
    plugins: [{ name: 'admin-video-runtime', setup(builder) {
      builder.onResolve({ filter: /^~\// }, ({ path }) => {
        if (['~/composables/useApi', '~/composables/useAuthService', '~/composables/useModal', '~/composables/useToast'].includes(path)) return { path, external: true };
        return { path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') || path.endsWith('.ts') ? '' : '.ts')) };
      });
      builder.onResolve({ filter: /^vue-router$/ }, () => ({ path: 'vue-router', external: true }));
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        const id = `data-v-${createHash('sha256').update(path).digest('hex').slice(0, 8)}`;
        compiledStyles.set(path, descriptor.styles.map(style => {
          const result = compileStyle({ id, filename: path, source: style.content, scoped: style.scoped });
          assert.deepEqual(result.errors, []);
          return result.code;
        }).join('\n'));
        return {
          contents: compileScript(descriptor, {
            id,
            genDefaultAs: 'component',
            inlineTemplate: true,
            templateOptions: { compilerOptions: { hoistStatic: false } },
          }).content + `\ncomponent.__scopeId = ${JSON.stringify(id)}; export default component;`,
          loader: 'ts',
          resolveDir: dirname(path),
        };
      });
    } }],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(name => {
    if (name === 'vue') return { ...Vue, Transition: Vue.BaseTransition };
    if (name === '~/composables/useApi') return { useApi: () => api };
    if (name === '~/composables/useAuthService') return { useAuthService: () => auth };
    if (name === '~/composables/useModal') return { useModal: () => modal };
    if (name === '~/composables/useToast') return { useToast: () => toast };
    if (name === 'vue-router') return { useRoute: () => ({ path: '/admin/video/intro', hash: '', fullPath: '/admin/video/intro' }) };
    if (name === '#components') return { NuxtLink: { props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: typeof props.to === 'string' ? props.to : props.to?.path }, slots.default?.()) } };
    return require(name);
  }, module, module.exports);
  runtime = module.exports.default;
  return runtime;
}

class Element {
  constructor(tag, text = '') { Vue.markRaw(this); this.tag = tag; this.text = text; this.props = {}; this.children = []; this.parent = null; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  matches(selector) {
    if (selector.startsWith('.')) return String(this.props.class ?? '').split(' ').includes(selector.slice(1));
    const attribute = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
    return attribute ? String(this.props[attribute[1]]) === attribute[2] : this.tag === selector;
  }
  all(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.all(selector)]); }
  find(selector) { return this.all(selector)[0]; }
}
function changed() { queueMicrotask(() => events.emit('render')); }
function remove(node) { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = null; changed(); }
const renderer = Vue.createRenderer({
  createElement: tag => new Element(tag), createText: text => new Element('#text', text), createComment: () => new Element('#comment'),
  setText(node, text) { node.text = text; changed(); }, setElementText(node, text) { node.text = text; node.children = []; changed(); },
  patchProp(node, key, _old, value) { node.props[key] = value; changed(); },
  insert(node, parent, anchor = null) { remove(node); parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, node); node.parent = parent; changed(); },
  remove, parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  querySelector: () => documentBody, setScopeId(node, id) { node.props[id] = ''; }, insertStaticContent() { throw new Error('Unexpected static HTML'); },
});
function rendered(predicate, action = () => {}) {
  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error(`Expected rendered state was not reached: ${current?.root.textContent}`)); }, 2000);
    const cleanup = () => { clearTimeout(timeout); events.off('render', observe); };
    const observe = () => { if (predicate()) { cleanup(); resolvePromise(); } };
    events.on('render', observe);
    Promise.resolve().then(action).then(observe, error => { cleanup(); reject(error); });
  });
}
function deferred() { let resolvePromise, reject; const promise = new Promise((yes, no) => { resolvePromise = yes; reject = no; }); return { promise, resolve: resolvePromise, reject }; }
function invoke(node, prop, event = { preventDefault() {}, stopImmediatePropagation() {} }) {
  assert.ok(node, `${prop} target exists`);
  const handlers = [node.props[prop]].flat().filter(Boolean);
  for (const handler of handlers) handler(event);
}
async function click(node) { invoke(node, 'onClick'); await Vue.nextTick(); }

const plans = [
  { id: 7, name: 'Actual default plan', description: '', is_default: true, is_active: true, created_by: 1, created_by_username: 'staff', subscriber_count: 4, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 8, name: 'Actual second plan', description: '', is_default: false, is_active: true, created_by: 1, created_by_username: 'staff', subscriber_count: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];
const intros = {
  7: [{ id: 41, plan: 7, plan_name: plans[0].name, book: '창세기', url_link: 'https://video.example/genesis', start_date: '2026-09-06', end_date: '2026-09-12' }],
  8: [{ id: 81, plan: 8, plan_name: plans[1].name, book: '마태복음', url_link: 'https://video.example/matthew', start_date: '2026-10-01', end_date: '2026-10-07' }],
};
const apps = [];
let current;
async function mount({ staff = true, handlers = {} } = {}) {
  const requests = [], prompts = [], notices = [];
  const isStaff = Vue.ref(staff);
  auth = {
    isInitialized: Vue.ref(true), isLoading: Vue.ref(false), isSessionUnknown: Vue.ref(false),
    isAuthenticated: Vue.ref(true), isStaff, user: Vue.ref({ id: 17, nickname: 'operator', email: 'staff@example.test', is_staff: staff }),
    initialize: async () => {}, revalidate: async () => {},
  };
  modal = { confirm: options => { prompts.push(options); return Promise.resolve(false); } };
  toast = { success: value => notices.push(['success', value]), warning: value => notices.push(['warning', value]), error: value => notices.push(['error', value]) };
  function request(method, path, body) {
    requests.push({ method, path, body }); changed();
    const handler = handlers[`${method} ${path}`] ?? handlers[path];
    if (handler) return Promise.resolve().then(() => handler(body));
    if (method === 'GET' && path === '/api/v1/todos/bible-plans/') return Promise.resolve({ data: { count: plans.length, next: null, previous: null, results: plans } });
    if (method === 'GET' && path === '/api/v1/todos/video/intro/') return Promise.resolve({ data: intros[body.params.plan_id] });
    if (method === 'DELETE') return Promise.resolve(null);
    if (method === 'POST') return Promise.resolve({ detail: 'ok' });
    throw new Error(`Unexpected ${method} ${path}`);
  }
  api = {
    GET: (path, options = {}) => request('GET', path, options), POST: (path, body) => request('POST', path, body),
    DELETE: path => request('DELETE', path), path: (path, values) => path.replace('{id}', String(values.id)),
  };
  documentBody = new Element('body');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const documentEvents = new Map();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: { style: {} },
    addEventListener(name, fn) { if (!documentEvents.has(name)) documentEvents.set(name, new Set()); documentEvents.get(name).add(fn); },
    removeEventListener(name, fn) { documentEvents.get(name)?.delete(fn); },
    dispatchEvent(event) { for (const fn of documentEvents.get(event.type) ?? []) fn(event); },
  } });
  const root = new Element('root');
  const app = renderer.createApp(await loadPage()); app.mount(root); apps.push(app);
  const view = { root, body: documentBody, app, requests, prompts, notices, handlers, auth };
  current = view;
  view.find = selector => root.find(selector) ?? documentBody.find(selector);
  view.all = selector => [...root.all(selector), ...documentBody.all(selector)];
  view.ready = () => rendered(() => !!view.find('[data-video-intro="41"]'));
  view.restore = () => previousDocument ? Object.defineProperty(globalThis, 'document', previousDocument) : delete globalThis.document;
  return view;
}
afterEach(() => { for (const app of apps.splice(0)) app.unmount(); current?.restore?.(); current = undefined; events.removeAllListeners(); });

const options = { timeout: 5000 };
test('the real admin shell does not mount the data owner until staff is authoritative', options, async () => {
  const view = await mount({ staff: false });
  assert.equal(view.find('[data-admin-video-workspace="true"]'), undefined);
  assert.deepEqual(view.requests, []);
  await rendered(() => !!view.find('[data-video-intro="41"]'), () => { view.auth.isStaff.value = true; });
  assert.deepEqual(view.requests.map(request => [request.method, request.path]), [
    ['GET', '/api/v1/todos/bible-plans/'], ['GET', '/api/v1/todos/video/intro/'],
  ]);
});

test('actual plan selection drives the heading and real video records', options, async () => {
  const view = await mount(); await view.ready();
  assert.match(view.root.find('h1').textContent, /Actual default plan/);
  const card = view.find('[data-video-intro="41"]');
  assert.match(card.textContent, /창세기/); assert.match(card.textContent, /2026/);
  assert.equal(card.find('a').props.href, 'https://video.example/genesis');
  assert.equal(card.find('[data-video-duration="true"]'), undefined);
  assert.equal(card.find('img'), undefined);
  await rendered(() => !!view.find('[data-video-intro="81"]'), () => invoke(view.find('[data-plan-select="true"]'), 'onChange', { target: { value: '8' } }));
  assert.match(view.root.find('h1').textContent, /Actual second plan/);
  const last = view.requests.at(-1); assert.equal(last.path, '/api/v1/todos/video/intro/'); assert.deepEqual(last.body.params, { plan_id: 8 });
});

test('danger deletion is single-flight; cancel and failure preserve, success removes', options, async () => {
  const view = await mount(); await view.ready();
  const decision = deferred(); modal.confirm = value => { view.prompts.push(value); return decision.promise; };
  const button = view.find('[data-delete-video="41"]'); await click(button); await click(button);
  assert.equal(view.prompts.length, 1); assert.equal(view.prompts[0].confirmVariant, 'danger');
  decision.resolve(false); await rendered(() => !button.props.disabled);
  assert.equal(view.requests.some(request => request.method === 'DELETE'), false);

  modal.confirm = async value => { view.prompts.push(value); return true; };
  const failed = deferred(); view.handlers['DELETE /api/v1/todos/video/intro/41/'] = () => failed.promise;
  await rendered(() => view.requests.some(request => request.method === 'DELETE'), () => click(button));
  failed.reject({ data: { detail: 'delete rejected' } });
  await rendered(() => !button.props.disabled);
  assert.ok(view.find('[data-video-intro="41"]'));

  view.handlers['DELETE /api/v1/todos/video/intro/41/'] = () => null;
  await rendered(() => !view.find('[data-video-intro="41"]'), () => click(button));
  assert.equal(view.notices.filter(([kind]) => kind === 'success').length, 1);
});

// Evaluate compiled scoped CSS against the actual teleported component tree.
// This is a declaration-cascade check, not a browser layout/animation simulation.
function modalStyle(view, target, { reduced = false, width = 1280, hovered = false } = {}) {
  const nodes = new Map();
  function convert(node) {
    const element = new CssElement(node.tag, Object.fromEntries(Object.entries(node.props)
      .filter(([key]) => key === 'class' || key.startsWith('data-v-'))
      .map(([key, value]) => [key, String(value)])));
    nodes.set(node, element);
    element.children = node.children.filter(child => !child.tag.startsWith('#')).map(convert);
    for (const child of element.children) child.parent = element;
    return element;
  }
  convert(view.body);
  const winners = new Map();
  const css = postcss.parse(compiledStyles.get(resolve(appDir, 'components/ui/modal/BaseModal.vue')));
  css.walkRules(rule => {
    for (let parent = rule.parent; parent?.type !== 'root'; parent = parent.parent) {
      if (parent.type !== 'atrule' || parent.name !== 'media') continue;
      if (parent.params === '(prefers-reduced-motion: reduce)' && !reduced) return;
      if (parent.params === '(max-width: 640px)' && width > 640) return;
      assert.ok(['(prefers-reduced-motion: reduce)', '(max-width: 640px)'].includes(parent.params));
    }
    for (const selector of selectorParser().astSync(rule.selector).nodes) {
      if (!matchesCss(nodes.get(target), selector.toString(), {
        pseudos: { hover: element => hovered && element === nodes.get(target) },
      })) continue;
      const specificity = selectorSpecificity(selector);
      rule.walkDecls(declaration => {
        const previous = winners.get(declaration.prop);
        if (!previous || Number(!!declaration.important) > Number(!!previous.important)
          || (!!declaration.important === !!previous.important && compare(specificity, previous.specificity) >= 0)) {
          winners.set(declaration.prop, { value: declaration.value, important: declaration.important, specificity });
        }
      });
    }
  });
  return Object.fromEntries([...winners].map(([property, declaration]) => [property, declaration.value]));
}

test('compiled upload close control has a nonshrinking token-sized target', options, async () => {
  const view = await mount(); await view.ready();
  await rendered(() => !!view.find('.base-modal-content'), () => click(view.find('[data-open-upload="true"]')));
  const close = view.find('.base-modal-close');
  const tokens = postcss.parse(await readFile(resolve(appDir, 'assets/css/themes.css'), 'utf8'));
  let hitMin;
  tokens.walkDecls('--hit-min', declaration => { hitMin = declaration.value; });
  for (const width of [390, 1280]) {
    const style = modalStyle(view, close, { width });
    const pixels = value => Number.parseFloat(value.replace('var(--hit-min)', hitMin));
    const minTarget = Number.parseFloat(hitMin);
    assert.ok(pixels(style.width) >= minTarget, `close width: ${style.width}`);
    assert.ok(pixels(style.height) >= minTarget, `close height: ${style.height}`);
    assert.equal(style['flex-shrink'], '0');
  }
  await rendered(() => !view.find('.base-modal-content'), () => click(close));
});

test('compiled upload close hover removes reduced motion but preserves normal feedback', options, async () => {
  const view = await mount(); await view.ready();
  await rendered(() => !!view.find('.base-modal-content'), () => click(view.find('[data-open-upload="true"]')));
  const close = view.find('.base-modal-close');
  for (const width of [390, 1280]) for (const hovered of [false, true]) {
    const normal = modalStyle(view, close, { width, hovered });
    const reduced = modalStyle(view, close, { width, hovered, reduced: true });
    assert.match(normal.transition, /0\.\d+s/);
    assert.equal(reduced.transition, 'none');
    assert.equal(reduced.background, normal.background);
    assert.equal(reduced.color, normal.color);
    if (hovered) {
      const idle = modalStyle(view, close, { width });
      assert.notEqual(normal.background, idle.background);
      assert.notEqual(normal.color, idle.color);
    }
  }
});

test('compiled upload enter and leave CSS removes reduced motion but preserves normal motion', options, async () => {
  const view = await mount(); await view.ready();
  await rendered(() => !!view.find('.base-modal-content'), () => click(view.find('[data-open-upload="true"]')));
  const overlay = view.find('.base-modal-overlay'), content = view.find('.base-modal-content');
  const original = overlay.props.class;
  for (const width of [390, 1280]) for (const phase of ['enter', 'leave']) {
    overlay.props.class = `${original} modal-fade-${phase}-active modal-fade-${phase === 'enter' ? 'enter-from' : 'leave-to'}`;
    for (const target of [overlay, content]) {
      assert.match(modalStyle(view, target, { width }).transition, /0\.\d+s/);
      assert.equal(modalStyle(view, target, { width, reduced: true }).transition, 'none');
    }
    assert.notEqual(modalStyle(view, content, { width }).transform, 'none');
    assert.equal(modalStyle(view, content, { width, reduced: true }).transform, 'none');
  }
  overlay.props.class = original;
});

function escape() { document.dispatchEvent({ type: 'keydown', key: 'Escape' }); }
function uploadCancel(view) { return view.find('.base-modal-footer').all('button').find(button => !button.props['data-upload-submit']); }
for (const method of ['Escape', 'scrim', 'cancel']) test(`video Excel already supports idle ${method} through its real BaseModal`, options, async () => {
  const view = await mount(); await view.ready(); const before = view.requests.length;
  await rendered(() => !!view.find('.base-modal-content'), () => click(view.find('[data-open-upload="true"]')));
  await rendered(() => !view.find('.base-modal-content'), () => method === 'Escape' ? escape() : click(method === 'scrim' ? view.find('.base-modal-overlay') : uploadCancel(view)));
  assert.equal(view.requests.length, before);
  await rendered(() => !!view.find('.base-modal-content'), () => click(view.find('[data-open-upload="true"]')));
});
test('video Excel dismissal cannot abandon upload or refresh and successful records reconcile', options, async () => {
  const upload = deferred(), refresh = deferred(); let uploaded = false;
  const view = await mount({ handlers: {
    'POST /api/v1/todos/video/intro/upload/': () => upload.promise,
    'GET /api/v1/todos/video/intro/': request => uploaded ? refresh.promise : { data: intros[request.params.plan_id] },
  } }); await view.ready();
  await rendered(() => !!view.find('.base-modal-content'), () => click(view.find('[data-open-upload="true"]')));
  invoke(view.find('[data-upload-file="true"]'), 'onChange', { target: { files: [new File(['fixture'], 'intros.xlsx')], value: 'intros.xlsx' } }); await Vue.nextTick();
  await rendered(() => !!view.find('[data-upload-progress="true"]'), () => {
    invoke(view.find('[data-upload-submit="true"]'), 'onClick');
    escape(); invoke(view.find('.base-modal-overlay'), 'onClick');
  });
  assert.ok(view.find('.base-modal-content')); assert.equal(uploadCancel(view).props.disabled, true);
  await click(view.find('.base-modal-close')); assert.ok(view.find('.base-modal-content'));
  uploaded = true;
  const reads = view.requests.filter(request => request.path === '/api/v1/todos/video/intro/').length;
  await rendered(() => view.requests.filter(request => request.path === '/api/v1/todos/video/intro/').length === reads + 1, () => upload.resolve({ detail: 'uploaded-fixture', errors: [] }));
  escape(); await click(view.find('.base-modal-overlay')); assert.ok(view.find('.base-modal-content'));
  assert.equal(uploadCancel(view).props.disabled, true);
  await rendered(() => !view.find('.base-modal-content') && !!view.find('[data-video-intro="42"]'), () => refresh.resolve({ data: [...intros[7], { ...intros[7][0], id: 42 }] }));
  assert.equal(view.requests.filter(request => request.method === 'POST').length, 1);
  assert.equal(view.notices.filter(([kind]) => kind === 'success').length, 1);
});

test('file validation and multipart upload preserve payload and recover after rejection', options, async () => {
  const upload = deferred();
  const view = await mount({ handlers: { 'POST /api/v1/todos/video/intro/upload/': () => upload.promise } }); await view.ready();
  await rendered(() => !!view.find('[data-upload-file="true"]'), () => click(view.find('[data-open-upload="true"]')));
  const fileInput = view.find('[data-upload-file="true"]');
  invoke(fileInput, 'onChange', { target: { files: [new File(['bad'], 'bad.txt')], value: 'bad.txt' } }); await Vue.nextTick();
  assert.ok(view.find('[data-file-error="true"]'));
  const file = new File(['sheet'], 'intros.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  invoke(fileInput, 'onChange', { target: { files: [file], value: 'intros.xlsx' } }); await Vue.nextTick();
  await rendered(() => view.requests.some(request => request.method === 'POST'), () => click(view.find('[data-upload-submit="true"]')));
  assert.ok(view.find('[data-upload-progress="true"]'));
  await click(view.find('[data-upload-submit="true"]'));
  const uploads = view.requests.filter(request => request.method === 'POST'); assert.equal(uploads.length, 1);
  assert.equal(uploads[0].body.get('plan_id'), '7'); assert.equal(uploads[0].body.get('file').name, 'intros.xlsx');
  await rendered(() => !!view.find('[data-upload-error="true"]') && !view.find('[data-upload-submit="true"]').props.disabled, () => upload.reject({ data: { detail: 'upload rejected', errors: ['row rejected'] } }));
  assert.equal(view.find('[data-upload-file="true"]').props.disabled, false);
  await rendered(() => !view.find('.base-modal-content'), escape);
});

test('partial upload remains open with row errors and refreshes accepted records', options, async () => {
  let uploaded = false;
  const view = await mount({ handlers: {
    'POST /api/v1/todos/video/intro/upload/': () => { uploaded = true; return { detail: 'partial', errors: ['one row'] }; },
    'GET /api/v1/todos/video/intro/': options => ({ data: uploaded ? [...intros[options.params.plan_id], { ...intros[7][0], id: 42, book: '출애굽기' }] : intros[options.params.plan_id] }),
  } }); await view.ready();
  await rendered(() => !!view.find('[data-upload-file="true"]'), () => click(view.find('[data-open-upload="true"]')));
  const file = new File(['sheet'], 'intros.xls');
  invoke(view.find('[data-upload-file="true"]'), 'onChange', { target: { files: [file], value: 'intros.xls' } }); await Vue.nextTick();
  await rendered(() => !!view.find('[data-upload-errors="true"]') && !!view.find('[data-video-intro="42"]'), () => click(view.find('[data-upload-submit="true"]')));
  assert.ok(view.find('[data-upload-file="true"]'));
  await rendered(() => !view.find('.base-modal-content'), () => click(view.find('.base-modal-overlay')));
  assert.ok(view.find('[data-video-intro="42"]'));
});

test('video read failure has an explicit retry without inventing empty data', options, async () => {
  let fail = true;
  const view = await mount({ handlers: { 'GET /api/v1/todos/video/intro/': options => { if (fail) throw new Error('offline'); return { data: intros[options.params.plan_id] }; } } });
  await rendered(() => !!view.find('[data-video-error="true"]'));
  assert.equal(view.find('[data-video-empty="true"]'), undefined);
  fail = false;
  await rendered(() => !!view.find('[data-video-intro="41"]'), () => click(view.find('[data-retry-videos="true"]')));
});

test('unmounting the staff child while delete confirmation is pending prevents the write', options, async () => {
  const view = await mount(); await view.ready(); const decision = deferred(); modal.confirm = () => decision.promise;
  await click(view.find('[data-delete-video="41"]'));
  await rendered(() => !view.find('[data-admin-video-workspace="true"]'), () => { view.auth.isStaff.value = false; });
  decision.resolve(true); await decision.promise; await Vue.nextTick();
  assert.equal(view.requests.some(request => request.method === 'DELETE'), false);
});

test('scoped styles encode the one-to-three-column responsive contract with tokens and reduced motion', options, async () => {
  const source = await readFile(sourcePath, 'utf8');
  const { descriptor, errors } = parse(source, { filename: sourcePath }); assert.deepEqual(errors, []);
  const result = compileStyle({ id: 'admin-video', filename: sourcePath, source: descriptor.styles[0].content, scoped: true }); assert.deepEqual(result.errors, []);
  assert.match(result.code, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(result.code, /@media\s*\(min-width:\s*1024px\)[\s\S]*repeat\(3,/);
  assert.match(result.code, /var\(--hit-min\)/); assert.match(result.code, /var\(--color-bg-card\)/);
  assert.match(result.code, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /@lucide\/vue/);
});
