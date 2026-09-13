import assert from 'node:assert/strict'
import { test as nodeTest } from 'node:test'
const test = (name, run) => nodeTest(name, { timeout: 3000 }, run)
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { renderToString } from '@vue/server-renderer'
import * as Vue from 'vue'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '../app')
function loader(overrides = {}) {
  const cache = new Map()
  function load(file) {
    if (overrides[file]) return overrides[file]
    file = file.startsWith('~/') ? resolve(root, file.slice(2)) : file
    if (!/\.(vue|ts)$/.test(file)) file += '.ts'
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }; cache.set(file, module)
    let source = readFileSync(file, 'utf8')
    if (file.endsWith('.vue')) {
      const { descriptor } = parse(source, { filename: file })
      source = compileScript(descriptor, { id: file, inlineTemplate: true, fs: { fileExists: existsSync, readFile: file => readFileSync(file, 'utf8') } }).content
    }
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const localRequire = name => name === 'vue' ? Vue : name.startsWith('~/') || name.startsWith('.')
      ? load(name.startsWith('~/') ? name : resolve(dirname(file), name)) : require(name)
    new Function('require', 'module', 'exports', js)(localRequire, module, module.exports)
    return module.exports
  }
  return load
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function platform() {
  const descendants = n => n.children.flatMap(c => [c, ...descendants(c)])
  function node(tag, text = '') {
    return Vue.markRaw({ tag, text, children: [], props: {}, parent: null, scrollLeft: 0, clientWidth: 342,
      get offsetWidth() { return this.props['data-share-slide'] !== undefined ? 188 : 342 },
      get offsetLeft() { return this.parent ? this.parent.children.filter(c => c.tag === 'article').indexOf(this) * 200 + 77 : 0 },
      querySelector(selector) { return descendants(this).find(c => c.tag === selector) ?? null },
      querySelectorAll(selector) { return descendants(this).filter(c => selector === '[data-share-slide]' ? c.props['data-share-slide'] !== undefined : c.tag === selector) },
      scrollTo({ left }) { this.scrollLeft = left },
    })
  }
  function remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null }
  const renderer = Vue.createRenderer({
    createElement: node, createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (n, text) => { n.text = text }, setElementText: (n, text) => { n.text = text; n.children = [] },
    insert(n, p, anchor) { remove(n); const i = p.children.indexOf(anchor); p.children.splice(i < 0 ? p.children.length : i, 0, n); n.parent = p }, remove,
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1],
    patchProp: (n, key, old, value) => { n.props[key] = value },
  })
  const root = node('root')
  return { renderer, root, all: () => descendants(root), find: id => descendants(root).find(n => n.props['data-testid'] === id) }
}
const assets = { logo: 'data:image/png;base64,AA==', fontCss: '@font-face{font-family:ShareKoPub;src:url(data:font/woff2;base64,AA==)}' }
const metadata = { dateLabel: '2031. 2. 3', nickname: '실제사용자', planName: '실제 플랜', readingRange: '요한복음 3장', streak: 12, progress: { completed: 4, total: 10, percent: 40 } }
const verse = { id: 'JHN-3-16', text: '하나님이 세상을 이처럼 사랑하사', reference: '요한복음 3:16' }
const render = (component, props) => renderToString(Vue.createSSRApp({ render: () => Vue.h(component, props) }))

test('slide construction uses only supplied data and category changes restart at zero', () => {
  const api = loader()('~/composables/bible/bibleShare')
  const input = { mode: 'complete', metadata, verses: [verse] }
  const story = api.buildBibleShareSlides(input, 'story')
  const feed = api.buildBibleShareSlides(input, 'feed')
  assert.deepEqual(story.map(x => x.kind), ['summary', 'streak', 'verse'])
  assert.deepEqual(feed.map(x => x.kind), ['feed', 'summary', 'verse'])
  assert.equal(story[2].verse, verse)
  assert.deepEqual(api.buildBibleShareSlides({ mode: 'complete', metadata: {}, verses: [] }, 'story').map(x => x.kind), ['summary'])
  assert.equal(api.buildBibleShareSlides({ mode: 'verse', metadata: {}, verses: [verse, { ...verse, id: 'other' }] }, 'feed').length, 1)
  assert.equal(api.buildBibleShareSlides({ mode: 'verse', metadata: {}, verses: [] }, 'story').length, 0)
  const state = api.createBibleShareState(input)
  state.select(2)
  assert.equal(state.index, 2)
  state.setCategory('feed')
  assert.equal(state.index, 0)
  assert.deepEqual(state.slides.map(x => x.kind), ['feed', 'summary', 'verse'])
  assert.equal(state.themeEligible, false)
  state.select(1)
  assert.equal(state.themeEligible, true)
})

test('real SFC card definitions render export-sized SVG with supplied data and embedded resources', async () => {
  const load = loader()
  for (const [kind, height] of [['Verse', 640], ['Summary', 640], ['Streak', 640], ['Feed', 360]]) {
    const component = load(`~/components/bible/share/ShareCard${kind}.vue`).default
    const html = await render(component, { metadata, verse, assets, theme: 'light' })
    assert.match(html, new RegExp(`viewBox="0 0 360 ${height}"`))
    assert.ok(html.includes(metadata.dateLabel))
    assert.ok(html.includes(assets.logo))
    assert.ok(html.includes('font-family:ShareKoPub'))
    const dark = await render(component, { metadata, verse, assets, theme: 'dark' })
    assert.equal(html === dark, ['Streak', 'Feed'].includes(kind))
  }
  const component = load('~/components/bible/share/ShareCardVerse.vue').default
  const feed = await render(component, { metadata, verse, assets, format: 'feed' })
  assert.match(feed, /viewBox="0 0 360 360"/)
  // The product footer is independent of user/plan metadata. Compare rendered
  // shipped copy across inputs rather than pinning its prose in this test.
  const ordinaryFeed = await render(component, { metadata: {}, verse, assets, format: 'feed' })
  const rightFooter = html => html.match(/<text[^>]*x="332"[^>]*y="328"[^>]*>([^<]+)<\/text>/)?.[1]
  assert.ok(rightFooter(ordinaryFeed))
  assert.equal(rightFooter(feed), rightFooter(ordinaryFeed))
  assert.notEqual(rightFooter(feed), metadata.planName)
  assert.ok(feed.includes(verse.reference))
  const unknown = await render(load('~/components/bible/share/ShareCardSummary.vue').default, { metadata: {}, assets })
  assert.doesNotMatch(unknown, /data-progress|data-streak/)
  const inApp = await render(load('~/components/bible/share/ShareCardSummary.vue').default, { metadata, assets, format: 'in-app' })
  assert.match(inApp, /viewBox="0 0 320 400"/)
})

test('text layout keeps complete Unicode text inside the card area without ellipsis', () => {
  const { layoutShareText } = loader()('~/composables/bible/bibleShare')
  const text = '하나님이 세상을 이처럼 사랑하사 '.repeat(18).trim()
  const layout = layoutShareText(text, 304, 210, 34)
  assert.equal(layout.lines.join(''), text)
  assert.ok(layout.lines.length * layout.fontSize * 1.44 <= 210)
  assert.ok(layout.lines.every(line => Array.from(line).length * layout.fontSize <= 304))
})

test('prepared file reaches native share synchronously and cancellation never downloads', async t => {
  const { useCertificationShare } = loader()('~/composables/useCertificationShare')
  const file = new File(['transport fixture, not PNG proof'], 'selected.png', { type: 'image/png' })
  const prepared = { file, dataUrl: 'data:image/png;base64,dHJhbnNwb3J0', width: 720, height: 1280 }
  const calls = []
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'https://example.test' }, isReactNativeWebView: true, isAndroidApp: false } })
  t.after(() => oldWindow ? Object.defineProperty(globalThis, 'window', oldWindow) : delete globalThis.window)
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async () => {} }, canShare: () => true, share: data => { calls.push(data); return Promise.reject(new DOMException('', 'AbortError')) } } })
  t.after(() => oldNavigator ? Object.defineProperty(globalThis, 'navigator', oldNavigator) : delete globalThis.navigator)
  const service = useCertificationShare()
  const done = service.shareCertification({ preparedImage: prepared })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].files[0], file)
  assert.deepEqual(Object.keys(calls[0]), ['files'])
  assert.equal(await done, 'shared')
  window.isAndroidApp = true
  window.ReactNativeWebView = { postMessage: message => calls.push(JSON.parse(message)) }
  await service.downloadCertificationImage(undefined, { preparedImage: prepared })
  assert.equal(calls[1].dataUrl, prepared.dataUrl)
  assert.equal(calls[1].action, 'save')
  window.isReactNativeWebView = false
  const sharingVerse = service.shareCertification({ preparedImage: prepared, title: verse.reference, subtitle: verse.text, shareUrl: 'https://example.test/bible?book=JHN&chapter=3&verse=16' })
  assert.equal(calls[2].files[0], file)
  assert.equal(calls[2].title, verse.reference)
  assert.equal(calls[2].text, verse.text)
  assert.equal(await sharingVerse, 'shared')
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  let canvases = 0
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement() { canvases++; throw new Error('No parallel artwork renderer') } } })
  t.after(() => previousDocument ? Object.defineProperty(globalThis, 'document', previousDocument) : delete globalThis.document)
  assert.equal(await service.shareCertification({ planId: 7 }), 'copied')
  assert.equal(canvases, 0, 'transport must never draw a second card definition')
  window.isReactNativeWebView = true; window.isAndroidApp = false
  const saving = service.downloadCertificationImage(undefined, { preparedImage: prepared })
  assert.equal(calls[3].files[0], file)
  await saving
  navigator.canShare = () => false
  assert.equal(await service.shareCertification({ preparedImage: prepared, planId: 7 }), 'copied')
  window.isAndroidApp = true; delete window.ReactNativeWebView
  assert.equal(await service.shareCertification({ preparedImage: prepared, planId: 7 }), 'copied')
  window.isReactNativeWebView = false
  const downloads = [], revoked = [], blobs = []
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: { append() {} }, createElement(tag) {
    assert.equal(tag, 'a')
    return { href: '', download: '', click() { downloads.push(this.download) }, remove() {} }
  } } })
  t.mock.method(URL, 'createObjectURL', blob => { blobs.push(blob); return 'blob:unit-transport' })
  t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url))
  assert.equal(await service.shareCertification({ preparedImage: prepared }), 'downloaded')
  await service.downloadCertificationImage(undefined, { preparedImage: prepared })
  assert.deepEqual(blobs, [file, file])
  assert.deepEqual(downloads, ['maeil1dok-tongdok-certification.png', 'maeil1dok-tongdok-certification.png'])
  assert.deepEqual(revoked, ['blob:unit-transport', 'blob:unit-transport'])
})

test('legacy modal delegates real metadata and ignores superseded certification responses', async t => {
  const requests = []
  const Sheet = Vue.defineComponent({ props: ['modelValue', 'mode', 'metadata', 'loading', 'planId', 'scheduleId'], setup: p => () => Vue.h('div', { 'data-testid': 'adapter-sheet', metadata: p.metadata, loading: p.loading }) })
  const load = loader({
    '~/components/bible/share/ShareSheet.vue': { default: Sheet },
    '~/components/ui/modal/BaseModal.vue': { default: Vue.defineComponent({ setup: () => () => null }) },
    '~/composables/useApi': { useApi: () => ({ GET: (path, options) => { const d = deferred(); requests.push({ ...d, options }); return d.promise } }) },
  })
  const component = load('~/components/bible/TongdokCertificationModal.vue').default
  const host = platform(), props = Vue.reactive({ modelValue: true, planId: 7, scheduleId: 13 })
  const app = host.renderer.createApp({ render: () => Vue.h(component, props) }); app.mount(host.root); t.after(() => app.unmount())
  assert.ok(host.find('adapter-sheet'), 'legacy surface delegates to the shared sheet')
  props.planId = 8; props.scheduleId = 14; await Vue.nextTick()
  assert.equal(requests.length, 2)
  const response = name => ({ data: { success: true, user: { id: 1, nickname: name }, plan: { id: 8, name: '진짜 플랜' }, card: { readingRange: '실제 범위', dateLabel: '2032-03-04' }, progress: { totalSchedules: 20, completedSchedules: 3, completionRate: 15, currentStreak: 2, totalCompletedDays: 3, latestCompletedAt: null, status: 'in_progress' } } })
  requests[1].resolve(response('현재')); await requests[1].promise; await Vue.nextTick()
  assert.equal(host.find('adapter-sheet').props.metadata.nickname, '현재')
  assert.deepEqual(host.find('adapter-sheet').props.metadata.progress, { completed: 3, total: 20, percent: 15 })
  requests[0].resolve(response('이전')); await requests[0].promise; await Vue.nextTick()
  assert.equal(host.find('adapter-sheet').props.metadata.nickname, '현재')
  props.planId = 9; await Vue.nextTick()
  requests[2].resolve(response('잘못된 플랜')); await requests[2].promise; await Vue.nextTick()
  assert.deepEqual(host.find('adapter-sheet').props.metadata, {})
  props.modelValue = false; await Vue.nextTick()
  assert.deepEqual(host.find('adapter-sheet').props.metadata, {})
})

test('mounted sheet rebuilds category slides, updates dots on scroll, and rejects stale preparations', async t => {
  const api = loader()('~/composables/bible/bibleShare')
  const jobs = [], starts = [], ready = [], shares = [], results = []
  let started = deferred(), becameReady = deferred()
  const load = loader({
    '~/components/ui/BottomSheet.vue': { default: Vue.defineComponent({ props: ['modelValue', 'title'], setup: (p, { slots }) => () => p.modelValue ? Vue.h('section', [slots['header-extra']?.(), slots.default?.(), slots.footer?.()]) : null }) },
    '~/composables/bible/bibleShare': { ...api, loadBibleShareAssets: async () => assets, prepareBibleShareImage: svg => {
      const job = deferred(); jobs.push(job); starts.push(svg); started.resolve(); return job.promise
    } },
    '~/composables/useCertificationShare': { useCertificationShare: () => ({ shareCertification: payload => { shares.push(payload); return Promise.resolve('shared') }, downloadCertificationImage: async () => {}, copyCertificationLink: async () => {} }) },
  })
  const Sheet = load('~/components/bible/share/ShareSheet.vue').default
  const host = platform()
  const props = Vue.reactive({ modelValue: true, mode: 'complete', metadata, verses: [verse], onReady: image => { ready.push(image); becameReady.resolve() }, onResult: value => results.push(value) })
  const app = host.renderer.createApp({ render: () => Vue.h(Sheet, props) }); app.mount(host.root); t.after(() => app.unmount())
  await started.promise
  assert.equal(starts[0].tag, 'svg')
  assert.equal(starts[0].props.viewBox, '0 0 360 640')
  assert.equal(host.find('share-send').props.disabled, true)
  const initialSlides = host.all().filter(n => n.props['data-share-slide'] !== undefined)
  started = deferred()
  host.find('share-category-feed').props.onClick()
  await started.promise
  assert.equal(starts[1].props.viewBox, '0 0 360 360')
  assert.equal(host.find('share-dot-0').props['aria-current'], 'true')
  assert.equal(host.find('share-theme-dark'), undefined)
  assert.ok(host.all().filter(n => n.props['data-share-slide'] !== undefined).every(n => !initialSlides.includes(n)))
  jobs[0].resolve({ file: 'stale' })
  await jobs[0].promise; await Vue.nextTick()
  assert.equal(ready.length, 0)
  const image = { file: 'selected transport fixture' }
  jobs[1].resolve(image); await becameReady.promise; await Vue.nextTick()
  assert.equal(host.find('share-send').props.disabled, false)
  const sharing = host.find('share-send').props.onClick()
  assert.equal(shares[0].preparedImage, image)
  await sharing; await Vue.nextTick()
  assert.equal(results[0].result, 'shared')
  started = deferred()
  const carousel = host.find('share-carousel'); carousel.scrollLeft = 400
  carousel.props.onScroll({ currentTarget: carousel })
  await started.promise
  assert.equal(host.find('share-dot-2').props['aria-current'], 'true')
  assert.ok(host.find('share-theme-dark'))
  assert.equal(host.find('share-send').props.disabled, true)
  started = deferred()
  host.find('share-theme-dark').props.onClick()
  await started.promise
  assert.equal(starts.at(-1).children.find(n => n.tag === 'rect').props.fill, '#2A1111')
  props.modelValue = false; await Vue.nextTick()
  jobs.at(-1).resolve({ file: 'closed' }); await jobs.at(-1).promise; await Vue.nextTick()
  assert.equal(ready.length, 1)
})
