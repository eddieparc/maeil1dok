import nodeTest from 'node:test'
const test = (name, run) => nodeTest(name, { timeout: 3000 }, run)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import postcss from 'postcss'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '../app')

// A synchronous clock is used only for the duration contract, not Vue lifecycles.
function clock(t) {
  let now = 0, sequence = 0
  const jobs = new Map()
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => {
    const id = ++sequence
    jobs.set(id, { at: now + delay, fn })
    return id
  })
  t.mock.method(globalThis, 'clearTimeout', id => jobs.delete(id))
  t.mock.method(Date, 'now', () => now)
  return {
    get pending() { return jobs.size },
    tick(ms) {
      const end = now + ms
      while (true) {
        const due = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        now = due[1].at
        jobs.delete(due[0])
        due[1].fn()
      }
      now = end
    }
  }
}

// Real Vue reactivity, SFC setup/render functions and lifecycle hooks; only Nuxt's
// state registry and renderer platform are supplied. No browser/layout claim.
function runtime(t, imports = {}) {
  const updates = new Set()
  const changed = () => { for (const observe of updates) queueMicrotask(observe) }
  function signal(predicate) {
    return new Promise(resolve => {
      const observe = () => { if (predicate()) { updates.delete(observe); resolve() } }
      updates.add(observe); observe()
    })
  }
  const cache = new Map(), states = new Map(), restorePlatform = []
  const Transition = Vue.defineComponent({ props: ['name'], inheritAttrs: false, setup(_, { slots }) { return () => slots.default?.() } })
  const TransitionGroup = Vue.defineComponent({ props: ['tag', 'name'], setup(props, { slots }) {
    return () => props.tag ? Vue.h(props.tag, slots.default?.()) : slots.default?.()
  } })
  function platform(name, value) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
    restorePlatform.push(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name])
  }
  function load(file) {
    file = file.startsWith('~/') ? resolve(root, file.slice(2)) : file
    if (!/\.(vue|ts)$/.test(file)) file += '.ts'
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    let source = readFileSync(file, 'utf8')
    if (file.endsWith('.vue')) {
      const { descriptor } = parse(source, { filename: file })
      source = compileScript(descriptor, { id: file, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content
    }
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const localRequire = name => {
      if (name === 'vue') return { ...Vue, Transition, TransitionGroup }
      if (name in imports) return imports[name]
      if (name.startsWith('~/') || name.startsWith('.')) return load(name.startsWith('~/') ? name : resolve(dirname(file), name))
      return require(name)
    }
    const useState = (key, init) => {
      if (!states.has(key)) states.set(key, Vue.ref(init()))
      return states.get(key)
    }
    new Function('require', 'module', 'exports', 'useState', 'useHead', js)(localRequire, module, module.exports, useState, () => {})
    return module.exports
  }
  const listeners = new Map(), resizeObservers = new Set(), mutationObservers = new Set()
  const doc = {
    activeElement: null,
    addEventListener(type, fn, options) {
      const capture = options === true || options?.capture === true
      const list = listeners.get(type) ?? []
      if (!list.some(x => x.fn === fn && x.capture === capture)) list.push({ fn, capture })
      listeners.set(type, list)
    },
    removeEventListener(type, fn, options) {
      const capture = options === true || options?.capture === true
      listeners.set(type, (listeners.get(type) ?? []).filter(x => x.fn !== fn || x.capture !== capture))
    },
    dispatch(type, values = {}) {
      const event = {
        type, target: doc.activeElement, defaultPrevented: false, stopped: false,
        preventDefault() { this.defaultPrevented = true },
        stopPropagation() { this.stopped = true },
        stopImmediatePropagation() { this.stopped = true },
        ...values
      }
      for (const capture of [true, false]) {
        for (const listener of [...(listeners.get(type) ?? [])].filter(x => x.capture === capture)) {
          listener.fn(event)
          if (event.stopped) return event
        }
      }
      return event
    },
    querySelector: selector => selector.startsWith('.') ? byClass(doc, selector.slice(1))[0] ?? null : null,
    createElement: tag => node(tag)
  }
  function node(tag, text = '') {
    return Vue.markRaw({
      tag, text, children: [], parentNode: null, props: {}, style: {}, offsetWidth: 0,
      bounds: { top: 844, height: 0 },
      getBoundingClientRect() { return this.bounds },
      get offsetParent() { return this.parentNode },
      get isConnected() { return this === doc.body || !!this.parentNode?.isConnected },
      appendChild(child) { insert(child, this) },
      removeChild(child) { remove(child) },
      contains(child) { return this === child || this.children.some(n => n.contains(child)) },
      querySelectorAll() {
        return descendants(this).filter(n => /^(button|input|select|textarea|a)$/.test(n.tag) && !n.props.disabled || n.props.tabindex !== undefined && String(n.props.tabindex) !== '-1')
      },
      focus() {
        if (!this.isConnected || this.props.disabled) return
        for (let ancestor = this; ancestor; ancestor = ancestor.parentNode) {
          if (ancestor.props.inert === true || ancestor.props.inert === '') return
        }
        doc.activeElement = this
        doc.dispatch('focusin', { target: this })
        changed()
      },
      getAttribute(key) { return this.props[key] ?? null },
      setAttribute(key, value) { this.props[key] = value },
      removeAttribute(key) { delete this.props[key] }
    })
  }
  function insert(child, parent, anchor = null) {
    remove(child)
    const at = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(at < 0 ? parent.children.length : at, 0, child)
    child.parentNode = parent
    changed()
  }
  function remove(child) {
    if (child.parentNode) child.parentNode.children.splice(child.parentNode.children.indexOf(child), 1)
    if (child.contains(doc.activeElement)) doc.activeElement = doc.body
    child.parentNode = null
    changed()
  }
  doc.body = node('body')
  doc.body.style.overflow = 'auto'
  doc.body.style.paddingRight = '7px'
  doc.activeElement = doc.body
  platform('document', doc)
  const viewport = { innerHeight: 844, addEventListener: doc.addEventListener, removeEventListener: doc.removeEventListener }
  platform('window', viewport)
  for (const [name, observers] of [['ResizeObserver', resizeObservers], ['MutationObserver', mutationObservers]]) {
    platform(name, class {
      constructor(callback) { this.callback = callback; this.targets = new Set() }
      observe(target) { this.targets.add(target); observers.add(this) }
      disconnect() { this.targets.clear(); observers.delete(this) }
    })
  }
  platform('getComputedStyle', el => ({ paddingRight: el.style.paddingRight || '0px', zIndex: el.style.zIndex || 'auto' }))
  // Existing focus implementation schedules RAF. Execute the frame explicitly.
  const frames = new Map(); let frameId = 0
  platform('requestAnimationFrame', fn => { frames.set(++frameId, fn); return frameId })
  platform('cancelAnimationFrame', id => frames.delete(id))
  const renderer = Vue.createRenderer({
    createElement: node, createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (n, text) => { n.text = text }, setElementText: (n, text) => { n.text = text; n.children = [] },
    parentNode: n => n.parentNode, nextSibling: n => n.parentNode?.children[n.parentNode.children.indexOf(n) + 1] ?? null,
    insert, remove, patchProp: (n, key, old, value) => {
      n.props[key] = value
      if (key === 'style') n.style = value ?? {}
      // Native disabled controls blur and cannot receive focus. Retaining the
      // opener here would hide the plans caller's pre-activation focus loss.
      if (key === 'disabled' && value && doc.activeElement === n) doc.activeElement = doc.body
      changed()
    },
    querySelector: selector => selector === 'body' ? doc.body : null,
    // CSS transitions are deliberately not emulated by this platform.
    forcePatchProp: () => false
  })
  const apps = []
  function mount(component, props = {}) {
    const container = node('root'); insert(container, doc.body)
    const app = renderer.createApp(component, props)
    const instance = app.mount(container)
    apps.push(app)
    return { instance, container, unmount: () => { app.unmount(); apps.splice(apps.indexOf(app), 1) } }
  }
  t.after(() => {
    try { apps.reverse().forEach(app => app.unmount()) }
    finally { updates.clear(); restorePlatform.reverse().forEach(restore => restore()) }
  })
  async function flush() {
    await Vue.nextTick()
    for (const [id, fn] of [...frames]) { frames.delete(id); fn() }
    await Vue.nextTick()
  }
  return {
    load, doc, node, mount, flush, viewport, signal,
    resize(target) { for (const observer of resizeObservers) if (observer.targets.has(target)) observer.callback([{ target }]) },
    mutate() { for (const observer of mutationObservers) observer.callback([]) },
    get observerCount() { return resizeObservers.size + mutationObservers.size }
  }
}
// The actual page, AppButton, API facade and complete service-modal lifecycle
// share one renderer, in app.vue order. Only app-shell/auth/HTTP boundaries vary.
async function plansModalRuntime(t) {
  const authState = Vue.ref('authenticated'), user = Vue.ref({ id: 1 })
  const auth = {
    authState, user, isAuthenticated: Vue.computed(() => authState.value === 'authenticated'),
    isLoading: Vue.ref(false), isSessionUnknown: Vue.ref(false), initialize: async () => {}
  }
  const requests = [], errors = []
  const subscription = { id: 82, plan_id: 8, plan_name: 'Fixture', start_date: '2026-01-01', is_active: false, is_default: false }
  let subscriptions = [subscription]
  const api = {
    path: (path, params) => path.replace('{id}', params.id),
    async GET(path) {
      requests.push(['GET', path])
      if (path === '/api/v1/todos/plans/user/') return { data: { subscriptions, available_plans: [] } }
      assert.equal(path, '/api/v1/todos/plan/82/summary/')
      return { data: { completed_days: 2, total_days: 3, percent: 66.67 } }
    },
    async DELETE(path) { requests.push(['DELETE', path]); subscriptions = []; return { data: undefined } }
  }
  const r = runtime(t, {
    '~/composables/useAuthService': { useAuthService: () => auth },
    '~/composables/useApi': { useApi: () => api },
    '~/composables/useToast': { useToast: () => ({ success() {} }) },
    '~/composables/useErrorHandler': { useErrorHandler: () => ({ handleApiError: error => errors.push(error) }) },
    '~/components/common/PageLayout.vue': { default: { setup: (_, { slots }) => () => Vue.h('main', slots.default?.()) } },
    '~/components/Toast.vue': { default: { render: () => null } },
    'vue-router': { useRouter: () => ({ push() {} }) },
    '#components': { NuxtLink: { render: () => Vue.h('a') } }
  })
  const Page = r.load('~/pages/plans/index.vue').default
  const Host = r.load('~/components/ui/modal/ModalHost.vue').default
  const state = r.load('~/composables/useModalState').useModalState()
  const ready = r.signal(() => !!byClass(r.doc, 'delete-action')[0])
  const mounted = r.mount({ render: () => [Vue.h(Page), Vue.h(Host)] })
  await ready; await r.flush()
  const trigger = byClass(r.doc, 'delete-action')[0]
  async function open() {
    const entered = r.signal(() => byClass(r.doc, 'modal-container')[0]?.contains(r.doc.activeElement))
    trigger.focus()
    clickControl(trigger)
    await entered; await r.flush()
    assert.equal(trigger.props.disabled, true, 'write lock remains held throughout confirmation')
    assert.equal(r.doc.body.style.overflow, 'hidden')
  }
  t.after(() => assert.deepEqual(errors, []))
  return { ...r, open, trigger, state, authState, user, requests, api, mounted }
}
function clickControl(control) {
  const event = { target: control, currentTarget: control, stopped: false,
    preventDefault() {}, stopImmediatePropagation() { this.stopped = true } }
  control.props.onClickCapture?.(event)
  if (!event.stopped) control.props.onClick(event)
  event.currentTarget = null // Native currentTarget is available only during dispatch.
}

for (const interaction of ['cancel', 'escape', 'scrim']) {
  test(`plans delete ${interaction} restores the exact still-present enabled opener after the real modal lifecycle`, async t => {
    const r = await plansModalRuntime(t)
    await r.open()
    const dialog = byClass(r.doc, 'modal-container')[0]
    const buttons = descendants(dialog).filter(node => node.tag === 'button')
    buttons.at(-1).focus(); r.doc.dispatch('keydown', { key: 'Tab' })
    assert.ok(r.doc.activeElement === buttons[0])
    r.doc.dispatch('keydown', { key: 'Tab', shiftKey: true })
    assert.ok(r.doc.activeElement === buttons.at(-1))
    clickControl(r.trigger)
    assert.equal(r.state.stack.value.length, 1, 'disabled opener cannot open a second confirmation')
    const returned = []
    r.doc.addEventListener('focusin', event => {
      if (event.target === r.trigger) returned.push({ disabled: r.trigger.props.disabled, open: r.state.isOpen.value })
    })
    const dismissed = r.signal(() => !byClass(r.doc, 'modal-container').length && !r.trigger.props.disabled)
    if (interaction === 'escape') r.doc.dispatch('keydown', { key: 'Escape' })
    else clickControl(byClass(r.doc, interaction === 'cancel' ? 'confirm-btn-cancel' : 'modal-overlay')[0])
    await dismissed; await r.flush()
    assert.ok(r.trigger.isConnected)
    assert.equal(r.doc.activeElement.tag, 'button', 'dismissal must not strand native focus on BODY')
    assert.ok(r.doc.activeElement === r.trigger, 'restore the invoking delete button, not another plan action')
    assert.deepEqual(returned, [{ disabled: false, open: false }], 'restore only after the rendered unlock')
    assert.equal(r.requests.filter(([method]) => method === 'DELETE').length, 0)
    assert.equal(r.doc.body.style.overflow, 'auto')
    assert.equal(r.doc.body.style.paddingRight, '7px')
  })
}

test('plans completion cannot steal focus from a newer service modal', async t => {
  const r = await plansModalRuntime(t)
  await r.open()
  const lowerId = r.state.topModal.value.id
  const entered = r.signal(() => byClass(r.doc, 'modal-container')[1]?.contains(r.doc.activeElement))
  const upperResult = r.state.open({ render: () => Vue.h('button') }).catch(() => false)
  await entered; await r.flush()
  const upperFocus = r.doc.activeElement
  const returned = []
  r.doc.addEventListener('focusin', event => { if (event.target === r.trigger) returned.push(event.target) })
  const unlocked = r.signal(() => !r.trigger.props.disabled)
  await r.state.close(lowerId, false)
  await unlocked; await r.flush()
  assert.ok(r.doc.activeElement === upperFocus)
  assert.deepEqual(returned, [])
  assert.equal(r.doc.body.style.overflow, 'hidden')
  r.doc.dispatch('keydown', { key: 'Escape' })
  assert.equal(await upperResult, false)
  await r.flush()
})

test('plans confirmed deletion does not focus a removed trigger or invent a fallback', async t => {
  const r = await plansModalRuntime(t)
  await r.open()
  const write = deferred(), called = deferred()
  r.api.DELETE = path => { r.requests.push(['DELETE', path]); called.resolve(); return write.promise }
  const request = called.promise
  clickControl(byClass(r.doc, 'confirm-btn-danger')[0])
  await request; await r.flush()
  assert.equal(r.trigger.props.disabled, true)
  const replacement = r.node('button'); r.doc.body.appendChild(replacement); replacement.focus()
  const focused = []
  r.doc.addEventListener('focusin', event => focused.push(event.target))
  const removed = r.signal(() => !r.trigger.isConnected)
  // Reconciliation, rather than a test DOM removal, removes the real card.
  r.api.GET = async path => {
    assert.equal(path, '/api/v1/todos/plans/user/')
    return { data: { subscriptions: [], available_plans: [] } }
  }
  write.resolve({ data: undefined })
  await removed; await r.flush()
  assert.deepEqual(r.requests.filter(([method]) => method === 'DELETE'), [['DELETE', '/api/v1/todos/plan/82/']])
  assert.ok(r.doc.activeElement === replacement)
  assert.deepEqual(focused, [])
})

function descendants(n) { return n.children.flatMap(child => [child, ...descendants(child)]) }
function byClass(doc, name) { return descendants(doc.body).filter(n => String(n.props.class || '').split(' ').includes(name)) }
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

// Read the actual component's declared CSS fallback, not a test-authored layer.
// Inline styles below come from its real compiled template and reactive setup.
function componentCSS(relative) {
  const file = resolve(root, relative)
  const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file })
  return postcss.parse(descriptor.styles.map(style => style.content).join('\n'))
}
function renderedLayerZ(node) {
  if (node.style.zIndex !== undefined) return Number(node.style.zIndex)
  const sheet = String(node.props.class).includes('bottom-sheet__overlay')
  let value
  componentCSS(sheet ? 'components/ui/BottomSheet.vue' : 'components/ui/modal/ModalHost.vue').walkRules(rule => {
    if (rule.parent.type !== 'root' || rule.selector !== (sheet ? '.bottom-sheet__overlay' : '.modal-wrapper')) return
    rule.walkDecls('z-index', declaration => { value = Number(declaration.value) })
  })
  assert.ok(Number.isFinite(value), 'rendered overlay must declare a numeric stacking layer')
  return value
}

for (const chain of [['modal', 'sheet', 'modal', 'sheet'], ['sheet', 'modal', 'sheet', 'modal']]) {
  test(`actual overlay paint styles, pointer eligibility and keyboard ownership agree: ${chain.join(' > ')}`, async t => {
    const r = runtime(t), opened = [], sheets = [Vue.ref(false), Vue.ref(false)]
    const trigger = r.node('button'); r.doc.body.appendChild(trigger); trigger.focus()
    const BottomSheet = r.load('~/components/ui/BottomSheet.vue').default
    const Host = r.load('~/components/ui/modal/ModalHost.vue').default
    const state = r.load('~/composables/useModalState').useModalState()
    // Match app.vue: page sheets are mounted BEFORE the global service host.
    r.mount(Vue.defineComponent({ setup() { return () => [
      ...sheets.map((open, index) => Vue.h(BottomSheet, {
        modelValue: open.value, title: `sheet-${index}`,
        'onUpdate:modelValue': value => { open.value = value }
      }, { default: () => Vue.h('button') })),
      Vue.h(Host)
    ] } }))
    await r.flush()
    const Content = Vue.defineComponent({ render: () => Vue.h('button') })
    let sheetIndex = 0
    function assertOwnership() {
      const top = opened.at(-1)
      for (let i = 1; i < opened.length; i++) {
        const entry = opened[i]
        assert.ok(renderedLayerZ(entry.layer) > renderedLayerZ(opened[i - 1].layer),
          `${entry.kind} layer ${renderedLayerZ(entry.layer)} must paint above older ${opened[i - 1].kind} layer ${renderedLayerZ(opened[i - 1].layer)}`)
      }
      for (const entry of opened) {
        const isTop = entry === top
        assert.equal(!!entry.layer.props.inert, !isTop, 'the full layer, including scrim, shares pointer ownership')
        assert.equal(String(entry.dialog.props['aria-modal'] ?? false), String(isTop))
        assert.equal(!!entry.dialog.props['aria-hidden'], !isTop)
      }
      assert.ok(top.dialog.contains(r.doc.activeElement), 'keyboard owner is the painted top layer')
      const buttons = descendants(top.dialog).filter(node => node.tag === 'button')
      buttons.at(-1).focus(); r.doc.dispatch('keydown', { key: 'Tab' })
      assert.ok(r.doc.activeElement === buttons[0])
      r.doc.dispatch('keydown', { key: 'Tab', shiftKey: true })
      assert.ok(r.doc.activeElement === buttons.at(-1))
      assert.equal(r.doc.body.style.overflow, 'hidden')
    }
    for (const kind of chain) {
      let result, open
      const previous = r.doc.activeElement
      if (kind === 'sheet') { open = sheets[sheetIndex++]; open.value = true }
      else result = state.open(Content).then(() => 'resolved', () => 'cancelled')
      await r.flush()
      const dialog = byClass(r.doc, kind === 'sheet' ? 'bottom-sheet' : 'modal-container').at(-1)
      const layer = dialog.parentNode
      opened.push({ kind, dialog, layer, result, open, previous })
      assertOwnership()
      // Even direct invocation of a stale scrim handler cannot cancel a lower owner.
      for (const lower of opened.slice(0, -1)) {
        const scrim = lower.kind === 'sheet' ? lower.layer : descendants(lower.layer).find(node => node.props.class === 'modal-overlay')
        scrim.props.onClick({ target: scrim, currentTarget: scrim })
      }
      await r.flush()
      assert.equal(state.stack.value.length + sheets.filter(open => open.value).length, opened.length)
    }
    while (opened.length) {
      const top = opened.pop()
      if (opened.length % 2) {
        const scrim = top.kind === 'sheet' ? top.layer : descendants(top.layer).find(node => node.props.class === 'modal-overlay')
        scrim.props.onClick({ target: scrim, currentTarget: scrim })
      } else r.doc.dispatch('keydown', { key: 'Escape' })
      await r.flush()
      if (top.result) assert.equal(await top.result, 'cancelled')
      else assert.equal(top.open.value, false)
      assert.ok(r.doc.activeElement === top.previous, 'dismissal restores the prior focus target')
      if (opened.length) assertOwnership()
    }
    assert.equal(state.stack.value.length, 0)
    assert.equal(r.doc.body.style.overflow, 'auto')
    assert.equal(r.doc.body.style.paddingRight, '7px')
    assert.ok(r.doc.activeElement === trigger)
  })
}

test('actual BottomSheet header avoids the legacy header selector and preserves dialog naming', async t => {
  const r = runtime(t)
  r.mount(r.load('~/components/ui/BottomSheet.vue').default, { modelValue: true, title: 'fixture-title' })
  await r.flush()
  const header = byClass(r.doc, 'bottom-sheet__header')[0]
  assert.notEqual(header.tag, 'header', 'legacy dark header background must not match the sheet heading wrapper')
  const heading = descendants(header).find(node => node.tag === 'h2')
  const dialog = byClass(r.doc, 'bottom-sheet')[0]
  assert.equal(dialog.props.role, 'dialog')
  assert.equal(dialog.props['aria-labelledby'], heading.props.id)
})

test('BottomSheet reduced-motion CSS disables the actual scrim opacity transition', () => {
  const rules = componentCSS('components/ui/BottomSheet.vue')
  for (const selector of ['.bottom-sheet-enter-active', '.bottom-sheet-leave-active']) {
    let transition
    rules.walkAtRules('media', media => {
      if (media.params !== '(prefers-reduced-motion: reduce)') return
      media.walkRules(rule => {
        if (rule.selectors.includes(selector)) rule.walkDecls('transition', declaration => { transition = declaration.value })
      })
    })
    assert.equal(transition, 'none', `${selector} scrim must not retain its opacity duration`)
  }
})

for (const type of ['info', 'success', 'warning', 'error']) {
  test(`${type} defaults to exactly 1800ms`, t => {
    const c = clock(t), r = runtime(t), toast = r.load('~/composables/useToast').useToast()
    toast[type]('message')
    c.tick(1799); assert.equal(toast.toasts.value.length, 1)
    c.tick(1); assert.equal(toast.toasts.value.length, 0)
    assert.equal(c.pending, 0)
  })
}

test('latest toast wins across service callers and replacement cancels its timer', t => {
  const c = clock(t), r = runtime(t), a = r.load('~/composables/useToast').useToast(), b = r.load('~/composables/useToast').useToast()
  a.show({ id: 'old', message: 'old', duration: 100 })
  b.show({ id: 'latest', message: 'latest', duration: 0 })
  assert.deepEqual(a.toasts.value.map(x => x.id), ['latest'])
  assert.equal(c.pending, 0)
  c.tick(10000); assert.equal(b.toasts.value.length, 1)
})

test('same-id show and update reset duration; duration zero and dismiss cancel timers', t => {
  const c = clock(t), r = runtime(t), state = r.load('~/composables/useToastState').useToastState()
  state.show({ id: 'same', message: 'first', duration: 100 })
  c.tick(90)
  state.show({ id: 'same', message: 'again', duration: 200 })
  c.tick(10); assert.equal(state.toasts.value.length, 1)
  c.tick(189); assert.equal(state.toasts.value.length, 1)
  c.tick(1); assert.equal(state.toasts.value.length, 0)
  state.show({ id: 'same', message: 'first', duration: 100 })
  c.tick(90)
  state.update('same', { message: 'updated', duration: 200 })
  c.tick(199); assert.equal(state.toasts.value.length, 1)
  c.tick(1); assert.equal(state.toasts.value.length, 0)
  state.show({ id: 'same', message: 'first', duration: 100 })
  state.update('same', { duration: 0 })
  assert.equal(c.pending, 0)
  c.tick(1000); assert.equal(state.toasts.value.length, 1)
  state.update('same', { duration: 100 })
  state.dismiss('same'); assert.equal(c.pending, 0)
  state.show({ id: 'same', message: 'new', duration: 200 })
  c.tick(100); assert.equal(state.toasts.value.length, 1)
  state.dismissAll(); assert.equal(c.pending, 0)
})

test('message-only update restarts current duration and cannot rename the timer identity', t => {
  const c = clock(t), r = runtime(t), state = r.load('~/composables/useToastState').useToastState()
  state.show({ id: 'stable', message: 'first', duration: 100 })
  c.tick(90)
  state.update('stable', { message: 'updated', id: 'other' })
  assert.equal(state.toasts.value[0].id, 'stable')
  c.tick(99); assert.equal(state.toasts.value.length, 1)
  c.tick(1); assert.equal(state.toasts.value.length, 0)
})

test('promise preserves outcomes and settles for 1800ms without reviving superseded toast', async t => {
  const c = clock(t), r = runtime(t), toast = r.load('~/composables/useToast').useToast()
  const success = deferred(), value = { ok: true }
  const returned = toast.promise(success.promise, { loading: 'loading', success: data => String(data.ok), error: 'error' })
  c.tick(10000); assert.equal(toast.toasts.value[0].duration, 0)
  success.resolve(value); assert.equal(await returned, value)
  c.tick(1799); assert.equal(toast.toasts.value.length, 1)
  c.tick(1); assert.equal(toast.toasts.value.length, 0)
  const failure = deferred(), error = new Error('failed')
  const rejected = toast.promise(failure.promise, { loading: 'loading', success: 'done', error: err => err.message })
  const observed = assert.rejects(rejected, err => err === error)
  failure.reject(error); await observed
  assert.equal(toast.toasts.value[0].type, 'error')
  c.tick(1800); assert.equal(toast.toasts.value.length, 0)
  const old = deferred()
  const oldResult = toast.promise(old.promise, { loading: 'loading', success: 'done', error: 'error' })
  toast.show({ id: 'latest', message: 'latest', duration: 0 })
  old.resolve(42); assert.equal(await oldResult, 42)
  assert.deepEqual(toast.toasts.value.map(x => x.id), ['latest'])
  assert.equal(c.pending, 0)
})

test('legacy template ref and injected ref share one nonrendering adapter and global host', async t => {
  clock(t)
  const r = runtime(t), toast = r.load('~/composables/useToast').useToast()
  const Legacy = r.load('~/components/Toast.vue').default
  const Host = r.load('~/components/ui/toast/ToastHost.vue').default
  const legacy = Vue.ref(null), local = Vue.ref(null), injected = Vue.ref(null)
  const Consumer = Vue.defineComponent({ setup() { injected.value = Vue.inject('toast'); return () => Vue.h(Legacy, { ref: local }) } })
  const Root = Vue.defineComponent({ setup() { Vue.provide('toast', legacy); return () => [Vue.h(Legacy, { ref: legacy }), Vue.h(Consumer), Vue.h(Host)] } })
  r.mount(Root); await r.flush()
  injected.value.value.show('injected', 'warning'); await r.flush()
  assert.equal(toast.toasts.value[0]?.type, 'warning')
  local.value.show('local'); await r.flush()
  assert.equal(toast.toasts.value.length, 1)
  assert.equal(toast.toasts.value[0].type, 'success')
  assert.equal(byClass(r.doc, 'toast-host').length, 1)
  assert.equal(byClass(r.doc, 'toast-item').length, 1)
  assert.equal(byClass(r.doc, 'toast-container').length, 1)
  toast.error('new'); await r.flush()
  assert.equal(byClass(r.doc, 'toast-item').length, 1)
  const item = byClass(r.doc, 'toast-item')[0]
  descendants(item).find(n => n.props.class === 'toast-dismiss').props.onClick()
  await r.flush(); assert.equal(byClass(r.doc, 'toast-item').length, 0)
})

async function modalRuntime(t) {
  const r = runtime(t)
  const modal = r.load('~/composables/useModal').useModal()
  const state = r.load('~/composables/useModalState').useModalState()
  // Built-in dialogs resolve their chunk before joining the stack.
  async function open(kind = 'confirm', options = {}) {
    const depth = state.stack.value.length
    const joined = r.signal(() => state.stack.value.length === depth + 1)
    const result = modal[kind]({ title: 'title', description: 'description', ...options })
    await joined
    await r.flush()
    return { result, id: state.topModal.value.id }
  }
  const trigger = r.node('button'); r.doc.body.appendChild(trigger); trigger.focus()
  r.mount(r.load('~/components/ui/modal/ModalHost.vue').default)
  await r.flush()
  return { ...r, modal, state, open, trigger }
}

for (const kind of ['confirm', 'alert']) {
  for (const interaction of ['escape', 'scrim']) {
    test(`${kind} ${interaction} cancels via shared surface and restores focus/scroll`, async t => {
      const r = await modalRuntime(t)
      const { result } = await r.open(kind)
      assert.equal(r.doc.body.style.overflow, 'hidden')
      if (interaction === 'escape') r.doc.dispatch('keydown', { key: 'Escape' })
      else byClass(r.doc, 'modal-overlay')[0].props.onClick()
      await r.flush()
      assert.equal(r.modal.stack.value.length, 0)
      assert.equal(await result, kind === 'confirm' ? false : undefined)
      assert.ok(r.doc.activeElement === r.trigger)
      assert.equal(r.doc.body.style.overflow, 'auto')
      assert.equal(r.doc.body.style.paddingRight, '7px')
    })
  }
}

test('danger confirm and explicit cancel retain boolean outcomes', async t => {
  const r = await modalRuntime(t)
  const a = await r.open('confirm', { confirmVariant: 'danger' })
  byClass(r.doc, 'confirm-btn-danger')[0].props.onClick()
  await r.flush(); assert.equal(await a.result, true)
  const b = await r.open()
  byClass(r.doc, 'confirm-btn-cancel')[0].props.onClick()
  await r.flush(); assert.equal(await b.result, false)
})

test('nested modals own one Tab/focus/Escape boundary and restore the underlying modal', async t => {
  const r = await modalRuntime(t)
  const a = await r.open(), lower = byClass(r.doc, 'modal-container')[0]
  const lowerButton = descendants(lower).find(n => n.tag === 'button'); lowerButton.focus()
  const b = await r.open(), upper = byClass(r.doc, 'modal-container')[1]
  const buttons = descendants(upper).filter(n => n.tag === 'button')
  buttons.at(-1).focus()
  r.doc.dispatch('keydown', { key: 'Tab' })
  assert.ok(r.doc.activeElement === buttons[0])
  r.doc.dispatch('keydown', { key: 'Tab', shiftKey: true })
  assert.ok(r.doc.activeElement === buttons.at(-1))
  r.trigger.focus()
  assert.ok(upper.contains(r.doc.activeElement), 'outside focus stays in topmost modal')
  byClass(r.doc, 'modal-overlay')[0].props.onClick()
  await r.flush(); assert.equal(r.modal.stack.value.length, 2, 'underlying scrim cannot cancel')
  r.doc.dispatch('keydown', { key: 'Escape' }); await r.flush()
  assert.equal(await b.result, false)
  assert.equal(r.modal.stack.value.length, 1)
  assert.ok(r.doc.activeElement === lowerButton)
  assert.equal(r.doc.body.style.overflow, 'hidden')
  r.doc.dispatch('keydown', { key: 'Escape' }); await r.flush()
  assert.equal(await a.result, false)
  assert.ok(r.doc.activeElement === r.trigger)
  assert.equal(r.doc.body.style.overflow, 'auto')
})

test('shared modal Escape never reaches an already-open sheet document listener', async t => {
  const r = runtime(t), sheetOpen = Vue.ref(true)
  const trigger = r.node('button'); r.doc.body.appendChild(trigger); trigger.focus()
  const BottomSheet = r.load('~/components/ui/BottomSheet.vue').default
  const Sheet = Vue.defineComponent({ setup() {
    return () => Vue.h(BottomSheet, {
      modelValue: sheetOpen.value,
      'onUpdate:modelValue': value => { sheetOpen.value = value }
    }, { default: () => Vue.h('button') })
  } })
  r.mount(Sheet); await r.flush()
  const sheetButton = r.doc.activeElement
  r.mount(r.load('~/components/ui/modal/ModalHost.vue').default)
  const modal = r.load('~/composables/useModal').useModal()
  const joined = r.signal(() => modal.stack.value.length === 1)
  const pending = modal.confirm({ title: 'confirm' })
  await joined; await r.flush()
  r.doc.dispatch('keydown', { key: 'Escape' }); await r.flush()
  assert.equal(sheetOpen.value, true)
  assert.equal(modal.stack.value.length, 0)
  assert.equal(await pending, false)
  assert.ok(r.doc.activeElement === sheetButton)
  assert.equal(r.doc.body.style.overflow, 'hidden')
  r.doc.dispatch('keydown', { key: 'Escape' }); await r.flush()
  assert.equal(sheetOpen.value, false)
  assert.ok(r.doc.activeElement === trigger)
  assert.equal(r.doc.body.style.overflow, 'auto')
})

test('unmount releases focus ownership and pending activation without stealing focus', async t => {
  const r = runtime(t), enabled = Vue.ref(true)
  const { useFocusTrap } = r.load('~/composables/useFocusTrap')
  const { useScrollLock } = r.load('~/composables/useScrollLock')
  const trigger = r.node('button'); r.doc.body.appendChild(trigger); trigger.focus()
  const Trap = Vue.defineComponent({ setup() {
    const el = Vue.ref(null)
    useFocusTrap(el, { enabled }); useScrollLock({ enabled })
    return () => Vue.h('div', { ref: el, tabindex: -1 }, [Vue.h('button')])
  } })
  const lower = r.mount(Trap); await r.flush()
  const upper = r.mount(Trap); await r.flush()
  const upperFocus = r.doc.activeElement
  lower.unmount(); await r.flush()
  assert.ok(r.doc.activeElement === upperFocus, 'removing a lower overlay cannot steal focus')
  upper.unmount(); await r.flush()
  assert.ok(r.doc.activeElement === trigger)
  assert.equal(r.doc.body.style.overflow, 'auto')
  assert.equal(r.doc.dispatch('keydown', { key: 'Tab' }).defaultPrevented, false)
  const transient = r.mount(Trap)
  transient.unmount(); await r.flush()
  assert.ok(r.doc.activeElement === trigger, 'a queued activation cannot focus after unmount')
})

test('async beforeClose is respected and repeated close completes the lifecycle once', async t => {
  const r = runtime(t), state = r.load('~/composables/useModalState').useModalState()
  const gate = deferred(); let calls = 0
  const result = state.open(Vue.defineComponent({ render: () => null }), { id: 'guarded', beforeClose: () => gate.promise, onClose: () => calls++ })
  const first = state.close('guarded', true), second = state.close('guarded', true)
  assert.equal(state.stack.value.length, 1)
  gate.resolve(true); await Promise.all([first, second])
  assert.equal(await result, true)
  assert.equal(calls, 1)
  const veto = state.open(Vue.defineComponent({ render: () => null }), { id: 'veto', beforeClose: () => false })
  await state.close('veto'); assert.equal(state.stack.value.length, 1)
  const rejected = assert.rejects(veto, reason => reason === 'cancel')
  state.cancel('veto', 'cancel'); await rejected
})


test('toast action runs once and cannot dismiss a newer toast created by its callback', async t => {
  const c = clock(t), r = runtime(t), toast = r.load('~/composables/useToast').useToast()
  r.mount(r.load('~/components/ui/toast/ToastHost.vue').default)
  let calls = 0
  toast.show({ message: 'action', action: { label: 'action', onClick() {
    calls++
    toast.show({ id: 'next', message: 'next', duration: 0 })
  } } })
  await r.flush()
  byClass(r.doc, 'toast-action')[0].props.onClick(); await r.flush()
  assert.equal(calls, 1)
  assert.deepEqual(toast.toasts.value.map(x => x.id), ['next'])
  assert.equal(c.pending, 0)
})

test('a newer real sheet owns Escape over an existing service modal', async t => {
  const r = await modalRuntime(t), lower = await r.open(), sheetOpen = Vue.ref(true)
  const modalFocus = r.doc.activeElement
  const BottomSheet = r.load('~/components/ui/BottomSheet.vue').default
  r.mount(Vue.defineComponent({ setup() {
    return () => Vue.h(BottomSheet, {
      modelValue: sheetOpen.value,
      'onUpdate:modelValue': value => { sheetOpen.value = value }
    }, { default: () => Vue.h('button') })
  } }))
  await r.flush()
  r.doc.dispatch('keydown', { key: 'Escape' }); await r.flush()
  assert.equal(sheetOpen.value, false)
  assert.equal(r.modal.stack.value.length, 1)
  assert.ok(r.doc.activeElement === modalFocus)
  assert.equal(r.doc.body.style.overflow, 'hidden')
  r.doc.dispatch('keydown', { key: 'Escape' }); await r.flush()
  assert.equal(await lower.result, false)
  assert.equal(r.doc.body.style.overflow, 'auto')
})


test('toast host follows actual reader stack geometry and releases its observers', async t => {
  const r = runtime(t)
  const host = r.mount(r.load('~/components/ui/toast/ToastHost.vue').default)
  await r.flush()
  const rendered = byClass(r.doc, 'toast-host')[0]
  const nav = r.node('nav'); nav.props.class = 'bottom-nav-container'
  // Reader 56px controls + 24px inset are already a total 80px, never 104px.
  nav.bounds = { top: 764, height: 80 }
  r.doc.body.appendChild(nav); r.mutate(); await r.flush()
  assert.equal(rendered.props.style?.['--toast-bottom-inset'], '80px')
  // Two independent 44px reader rows, then a larger native/device inset.
  nav.bounds = { top: 676, height: 168 }; r.resize(nav); await r.flush()
  assert.equal(rendered.props.style['--toast-bottom-inset'], '168px')
  nav.bounds = { top: 666, height: 178 }; r.resize(nav); await r.flush()
  assert.equal(rendered.props.style['--toast-bottom-inset'], '178px')
  // Actual legacy controls may be taller than the new rows; measure, don't guess.
  nav.bounds = { top: 600, height: 244 }; r.resize(nav); await r.flush()
  assert.equal(rendered.props.style['--toast-bottom-inset'], '244px')
  r.viewport.innerHeight = 900
  nav.bounds = { top: 700, height: 200 }; r.doc.dispatch('resize'); await r.flush()
  assert.equal(rendered.props.style['--toast-bottom-inset'], '200px')
  // Desktop tabs disappear: restore the CSS safe-area-only fallback.
  nav.bounds = { top: 900, height: 0 }; r.resize(nav); await r.flush()
  assert.equal(rendered.props.style['--toast-bottom-inset'], undefined)
  r.doc.body.removeChild(nav); r.mutate(); await r.flush()
  assert.equal(rendered.props.style['--toast-bottom-inset'], undefined)
  host.unmount()
  assert.equal(r.observerCount, 0)
})


// A service dialog must be fully resolved before it joins the stack: the scrim
// and the panel then enter in the same frame instead of the panel popping later.
test('confirm joins the stack as a resolved component whose content renders on the first frame', async t => {
  const r = runtime(t)
  const modal = r.load('~/composables/useModal').useModal()
  const state = r.load('~/composables/useModalState').useModalState()
  r.mount(r.load('~/components/ui/modal/ModalHost.vue').default)
  await r.flush()
  const joined = r.signal(() => state.stack.value.length === 1)
  const result = modal.confirm({ title: 'title', description: 'description' })
  await joined
  assert.equal(state.topModal.value.component.__asyncLoader, undefined, 'stack entry must not be an async wrapper')
  await r.flush()
  const panel = byClass(r.doc, 'modal-container')[0]
  assert.ok(panel, 'panel rendered')
  assert.ok(byClass(r.doc, 'confirm-title').length === 1 && panel.contains(byClass(r.doc, 'confirm-title')[0]), 'content is present with the panel, no loader awaited')
  byClass(r.doc, 'confirm-btn-cancel')[0].props.onClick(); await r.flush()
  assert.equal(await result, false)
})

test('ModalHost reduced-motion CSS disables the single layer transition', () => {
  const rules = componentCSS('components/ui/modal/ModalHost.vue')
  for (const selector of ['.modal-enter-active', '.modal-leave-active']) {
    let transition
    rules.walkAtRules('media', media => {
      if (media.params !== '(prefers-reduced-motion: reduce)') return
      media.walkRules(rule => {
        if (rule.selectors.includes(selector)) rule.walkDecls('transition', declaration => { transition = declaration.value })
      })
    })
    assert.equal(transition, 'none', `${selector} must not retain a duration under reduced motion`)
  }
})
