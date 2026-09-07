import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'
import { compileScript, parse } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import * as Icons from '@lucide/vue'

const root = fileURLToPath(new URL('../', import.meta.url))
let moduleSequence = 0

function storage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

async function loadTongdok(runtime) {
  globalThis.__tongdokV2 = runtime
  const result = await build({
    stdin: { contents: `export * from '~/composables/useTongdokMode';`, resolveDir: root }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    plugins: [{ name: 'tongdok-v2-runtime', setup(builder) {
      builder.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'runtime' }))
      builder.onResolve({ filter: /^vue-router$/ }, () => ({ path: 'router', namespace: 'runtime' }))
      builder.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => ({ contents: path === 'vue' ? `export const ref=globalThis.__tongdokV2.Vue.ref; export const computed=globalThis.__tongdokV2.Vue.computed;` : `export const useRoute=()=>globalThis.__tongdokV2.route; export const useRouter=()=>globalThis.__tongdokV2.router;` }))
      builder.onResolve({ filter: /(?:^|\/)useApi$/ }, () => ({ path: 'api', namespace: 'service' }))
      builder.onResolve({ filter: /(?:^|\/)useBibleData$/ }, () => ({ path: 'bible', namespace: 'service' }))
      builder.onLoad({ filter: /.*/, namespace: 'service' }, ({ path }) => ({ contents: path === 'api' ? `export const useApi=()=>globalThis.__tongdokV2.api;` : `export const BIBLE_BOOKS={old:[{id:'gen'},{id:'exo'}],new:[{id:'jhn'}]}; export const useBibleData=()=>({bookNames:{gen:'창세기',exo:'출애굽기',jhn:'요한복음'}});` }))
      builder.onResolve({ filter: /^~\// }, ({ path }) => ({ path: `${root}/app/${path.slice(2)}${path.endsWith('.ts') ? '' : '.ts'}` }))
    } }],
  })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${++moduleSequence}`)
}

function detail({ planId = 7, book = 'gen', chapter = 2, date = '2026-09-06', rows } = {}) {
  return { book, book_kor: book === 'exo' ? '출애굽기' : '창세기', chapter: String(chapter), plan_id: planId, plan_name: '2026 성경통독', plan_date: date, is_complete: false,
    plan_detail: rows ?? [
      { book: 'gen', book_kor: '창세기', start_chapter: 1, end_chapter: 2, schedule_id: 101, date, is_complete: false },
      { book: 'exo', book_kor: '출애굽기', start_chapter: 1, end_chapter: 1, schedule_id: 102, date, is_complete: false },
    ] }
}
function tongdokRuntime({ path = '/bible', query = {}, saved, get, post } = {}) {
  const calls = []; const localStorage = storage(saved ? { tongdokModeState: JSON.stringify(saved) } : {})
  const runtime = { Vue, route: Vue.reactive({ path, query }), router: { replace: value => calls.push(['replace', value]) }, calls, localStorage,
    api: {
      GET: async (url, options) => { calls.push(['GET', url, options.params]); return { data: await get(options.params) } },
      POST: async (url, payload) => { calls.push(['POST', url, payload]); return post ? post(payload) : { success: true, plan_id: String(payload.plan_id), schedule_ids: payload.schedule_ids.map(String), is_completed: true } },
    } }
  globalThis.window = { localStorage }; globalThis.localStorage = localStorage
  return runtime
}

test('bare bible hub does not reactivate persisted tongdok identity', async () => {
  const runtime = tongdokRuntime({ saved: { enabled: true, scheduleId: 101, planId: 7, scheduleDate: '2026-09-06', updatedAt: 'x' }, get: async () => detail() })
  const { useTongdokMode } = await loadTongdok(runtime); const mode = useTongdokMode(); mode.initTongdokMode()
  assert.equal(mode.tongdokMode.value, false); assert.equal(mode.tongdokPlanId.value, null); assert.ok(runtime.localStorage.getItem('tongdokModeState'))
  runtime.route.query = { book: 'gen', chapter: '2' }; mode.initTongdokMode()
  assert.equal(mode.tongdokMode.value, true); assert.equal(mode.tongdokScheduleId.value, 101)
})

test('progress separates completed count from the current ordinal', async () => {
  const runtime = tongdokRuntime({ path: '/bible', query: { tongdok: 'true', plan: '7', schedule: '101' }, get: async () => detail({ chapter: 3, rows: [{ book: 'gen', book_kor: '창세기', start_chapter: 1, end_chapter: 3, schedule_id: 101, date: '2026-09-06', is_complete: false }] }) })
  const { useTongdokMode } = await loadTongdok(runtime); const mode = useTongdokMode(); mode.initTongdokMode(); await mode.loadReadingDetail(7, 'gen', 3)
  assert.deepEqual(mode.getTongdokProgress('gen', 3), { current: 3, total: 3, done: 0, isCurrentInRange: true, isComplete: false })
  assert.equal(mode.markCurrentChapter('gen', 3), true)
  assert.deepEqual(mode.getTongdokProgress('gen', 3), { current: 3, total: 3, done: 1, isCurrentInRange: true, isComplete: false })
  assert.equal(mode.getTongdokProgress('exo', 9)?.current, 0)
})

test('detail cache is context-scoped and stale responses cannot replace it', async () => {
  const first = deferred(), second = deferred(); let request = 0
  const runtime = tongdokRuntime({ path: '/bible', query: { tongdok: 'true', plan: '7', schedule: '101' }, get: () => ++request === 1 ? first.promise : second.promise })
  const { useTongdokMode } = await loadTongdok(runtime); const mode = useTongdokMode(); mode.initTongdokMode()
  const oldLoad = mode.loadReadingDetail(7, 'gen', 1); mode.enableTongdokMode(201, 8, '2026-09-07'); const newLoad = mode.loadReadingDetail(8, 'gen', 1)
  second.resolve(detail({ planId: 8, chapter: 1, date: '2026-09-07', rows: [{ book: 'gen', book_kor: '창세기', start_chapter: 1, end_chapter: 1, schedule_id: 201, date: '2026-09-07', is_complete: false }] })); await newLoad
  first.resolve(detail({ planId: 7, chapter: 1 })); await oldLoad
  assert.equal(mode.readingDetailResponse.value.data.plan_id, 8); assert.equal(mode.readingDetailResponse.value.data.plan_detail[0].schedule_id, 201)
  await mode.loadReadingDetail(8, 'gen', 1); assert.equal(runtime.calls.filter(call => call[0] === 'GET').length, 2)
  mode.enableTongdokMode(202, 8, '2026-09-07'); await mode.loadReadingDetail(8, 'gen', 1)
  assert.equal(runtime.calls.filter(call => call[0] === 'GET').length, 3)
})

test('completeCurrentChapter persists only fully visited real rows and retains completed mode', async () => {
  const rows = [{ book: 'gen', book_kor: '창세기', start_chapter: 1, end_chapter: 2, schedule_id: 101, date: '2026-09-06', is_complete: false }, { book: 'exo', book_kor: '출애굽기', start_chapter: 1, end_chapter: 1, schedule_id: 102, date: '2026-09-06', is_complete: false }]
  const runtime = tongdokRuntime({ path: '/bible', query: { tongdok: 'true', plan: '7', schedule: '101' }, get: async ({ book, chapter }) => detail({ book, chapter, rows: structuredClone(rows) }) })
  const { useTongdokMode } = await loadTongdok(runtime); const mode = useTongdokMode(); mode.initTongdokMode()
  await mode.loadReadingDetail(7, 'gen', 1); let result = await mode.completeCurrentChapter('gen', 1)
  assert.equal(result.status, 'progressed'); assert.deepEqual(result.persistedScheduleIds, [])
  await mode.loadReadingDetail(7, 'gen', 2); result = await mode.completeCurrentChapter('gen', 2)
  assert.equal(result.status, 'progressed'); assert.deepEqual(result.persistedScheduleIds, [101]); assert.equal(result.scheduleCompleted, false)
  assert.equal(mode.readingDetailResponse.value.data.plan_detail.find(row => row.schedule_id === 101).is_complete, true)
  await mode.loadReadingDetail(7, 'exo', 1)
  assert.equal(mode.readingDetailResponse.value.data.plan_detail.find(row => row.schedule_id === 101).is_complete, true)
  result = await mode.completeCurrentChapter('exo', 1)
  assert.equal(result.status, 'completed'); assert.deepEqual(result.persistedScheduleIds, [102]); assert.deepEqual(result.completedScheduleIds, [101, 102]); assert.equal(result.scheduleCompleted, true)
  assert.equal(mode.tongdokMode.value, true); assert.equal(mode.tongdokScheduleId.value, 101)
  assert.deepEqual(runtime.calls.filter(call => call[0] === 'POST').map(call => call[2].schedule_ids), [[101], [102]])
})

for (const failure of ['network failure', 'rejected acknowledgement', 'mismatched acknowledgement']) {
  for (const priorCompletion of ['server', 'session']) {
    test(`final chapter ${failure} retains ${priorCompletion} completion and retryable partial progress`, { timeout: 5000 }, async () => {
      const response = deferred(), started = deferred()
      const rows = [
        { book: 'gen', start_chapter: 1, end_chapter: 1, schedule_id: 101, date: '2026-09-06', is_complete: priorCompletion === 'server' },
        { book: 'exo', start_chapter: 1, end_chapter: 2, schedule_id: 102, date: '2026-09-06', is_complete: false },
      ]
      let failNext = true
      const runtime = tongdokRuntime({
        query: { tongdok: 'true', plan: '7', schedule: '101' },
        get: async ({ book, chapter }) => detail({ book, chapter, rows: structuredClone(rows) }),
        post: payload => {
          if (payload.schedule_ids.includes(102) && failNext) {
            failNext = false
            started.resolve()
            return response.promise
          }
          return { success: true, plan_id: String(payload.plan_id), schedule_ids: payload.schedule_ids.map(String), is_completed: true }
        },
      })
      const { useTongdokMode } = await loadTongdok(runtime)
      const mode = useTongdokMode(); mode.initTongdokMode()
      if (priorCompletion === 'session') {
        await mode.loadReadingDetail(7, 'gen', 1)
        assert.deepEqual((await mode.completeCurrentChapter('gen', 1)).persistedScheduleIds, [101])
      }
      await mode.loadReadingDetail(7, 'exo', 1)
      const partial = await mode.completeCurrentChapter('exo', 1)
      assert.equal(partial.status, 'progressed')
      assert.deepEqual(partial.persistedScheduleIds, [])
      await mode.loadReadingDetail(7, 'exo', 2)
      const incompleteProgress = { current: 3, total: 3, done: 2, isCurrentInRange: true, isComplete: false }
      assert.deepEqual(mode.getTongdokProgress('exo', 2), incompleteProgress)
      const pending = mode.completeCurrentChapter('exo', 2)
      await started.promise
      const pendingProgress = mode.getTongdokProgress('exo', 2)
      assert.equal(mode.isCompleting.value, true)
      if (failure === 'network failure') response.reject(new TypeError('Failed to fetch'))
      else response.resolve({ success: failure !== 'rejected acknowledgement', plan_id: '7', schedule_ids: failure === 'mismatched acknowledgement' ? ['999'] : ['102'], is_completed: true })
      const result = await pending
      assert.equal(result.status, 'failed')
      assert.equal(result.ok, false)
      assert.deepEqual(result.persistedScheduleIds, [])
      assert.deepEqual(result.completedScheduleIds, [101])
      assert.equal(result.scheduleCompleted, false)
      assert.deepEqual(result.progress, incompleteProgress)
      assert.deepEqual(pendingProgress, incompleteProgress)
      assert.deepEqual(mode.lastCompleteCurrentResult.value, result)
      assert.equal(mode.isCompleting.value, false)
      assert.equal(mode.tongdokMode.value, true)
      assert.equal(mode.isScheduleCompleted(), false)
      assert.equal(mode.isChapterCompleted('gen', 1), true)
      assert.equal(mode.isChapterCompleted('exo', 1), true)
      assert.equal(mode.isChapterCompleted('exo', 2), false)
      assert.equal(mode.readingDetailResponse.value.data.plan_detail[1].is_complete, false)
      await mode.loadReadingDetail(7, 'exo', 2)
      assert.deepEqual(mode.getTongdokProgress('exo', 2), incompleteProgress)
      assert.equal(mode.isChapterCompleted('exo', 2), false)

      const retry = await mode.completeCurrentChapter('exo', 2)
      assert.equal(retry.status, 'completed')
      assert.equal(retry.ok, true)
      assert.equal(retry.scheduleCompleted, true)
      assert.deepEqual(retry.persistedScheduleIds, [102])
      assert.deepEqual(retry.completedScheduleIds, [101, 102])
      assert.equal(mode.getTongdokProgress('exo', 2).done, 3)
      assert.equal(mode.isChapterCompleted('exo', 2), true)
      assert.equal(mode.isScheduleCompleted(), true)
      assert.equal(mode.readingDetailResponse.value.data.plan_detail[1].is_complete, true)
      const writes = runtime.calls.filter(call => call[0] === 'POST').map(call => call[2])
      assert.deepEqual(writes.slice(-2), Array.from({ length: 2 }, () => ({ plan_id: 7, schedule_ids: [102], action: 'complete' })))
      assert.equal((await mode.completeCurrentChapter('exo', 2)).status, 'already-complete')
      assert.equal(runtime.calls.filter(call => call[0] === 'POST').length, writes.length)
    })
  }
}

// Mirrors get_chapter_detail: choose the containing schedule, return that date's
// rows, or return an empty range and no date/audio/guide for an unscheduled chapter.
function rangeDetail({ plan_id, book, chapter }) {
  const base = { book, chapter: String(chapter), plan_id: String(plan_id), plan_name: `Plan ${plan_id}` }
  const idOffset = plan_id === 8 ? 100 : 0
  const scheduled = (book === 'gen' && chapter <= 4) || (book === 'exo' && chapter === 1)
  if (!scheduled) return { ...base, plan_detail: [], message: 'No schedule', fallback_audio_links: [{ book, chapter, url: `https://example.com/${book}/${chapter}` }] }
  const date = book === 'gen' && chapter >= 3 ? '2026-09-07' : '2026-09-06'
  const rows = date === '2026-09-07'
    ? [{ book: 'gen', start_chapter: 3, end_chapter: 4, schedule_id: String(103 + idOffset), date, is_complete: false }]
    : [
        { book: 'gen', start_chapter: 1, end_chapter: 2, schedule_id: String(101 + idOffset), date, is_complete: false },
        { book: 'exo', start_chapter: 1, end_chapter: 1, schedule_id: String(102 + idOffset), date, is_complete: false },
      ]
  return { ...base, plan_date: date, plan_detail: rows, is_complete: false, audio_link: `https://example.com/audio/${date}`, guide_link: `https://example.com/guide/${date}`, fallback_audio_links: [] }
}

for (const chapter of [3, 8]) {
  test(`browsing ${chapter === 3 ? 'another date' : 'an unscheduled chapter'} preserves the active range and rejects completion without writes`, async () => {
    const runtime = tongdokRuntime({ query: { tongdok: 'true', plan: '7', schedule: '101' }, get: async params => rangeDetail(params) })
    const { useTongdokMode } = await loadTongdok(runtime); const mode = useTongdokMode(); mode.initTongdokMode()
    await mode.loadReadingDetail(7, 'exo', 1)
    assert.deepEqual((await mode.completeCurrentChapter('exo', 1)).persistedScheduleIds, [102])
    await mode.loadReadingDetail(7, 'gen', 1)
    assert.equal((await mode.completeCurrentChapter('gen', 1)).status, 'progressed')
    const activeRows = structuredClone(Vue.toRaw(mode.readingDetailResponse.value.data.plan_detail))
    const activeSections = mode.getCurrentSectionChapters('gen')
    const activeRange = mode.getFullScheduleRange()
    const beforeWrites = runtime.calls.filter(call => call[0] === 'POST').length
    const browsed = await mode.loadReadingDetail(7, 'gen', chapter)
    assert.equal(browsed.plan_date, chapter === 3 ? '2026-09-07' : undefined)
    assert.deepEqual(browsed.plan_detail.map(row => row.schedule_id), chapter === 3 ? ['103'] : [])
    // The root reloads detail immediately before attempting completion (cache path).
    await mode.loadReadingDetail(7, 'gen', chapter)
    const result = await mode.completeCurrentChapter('gen', chapter)
    assert.equal(result.status, 'out-of-range')
    assert.equal(result.ok, false)
    assert.equal(result.markedChapter, null)
    assert.deepEqual(result.persistedScheduleIds, [])
    assert.deepEqual(result.completedScheduleIds, [102])
    assert.equal(result.selectedScheduleId, 101)
    assert.equal(result.scheduleDate, '2026-09-06')
    const expectedProgress = { current: 0, total: 3, done: 2, isCurrentInRange: false, isComplete: false }
    assert.deepEqual(result.progress, expectedProgress)
    assert.deepEqual(mode.getTongdokProgress('gen', chapter), expectedProgress)
    assert.equal(runtime.calls.filter(call => call[0] === 'POST').length, beforeWrites)
    assert.equal(mode.markCurrentChapter('gen', chapter), false)
    assert.equal(mode.isChapterCompleted('gen', chapter), false)
    assert.equal(mode.isChapterCompleted('gen', 1), true)
    assert.equal(mode.isChapterCompleted('exo', 1), true)
    assert.deepEqual(mode.readingDetailResponse.value.data.plan_detail, activeRows)
    assert.deepEqual(mode.getCurrentSectionChapters('gen'), activeSections)
    assert.equal(mode.getFullScheduleRange(), activeRange)
    assert.equal(mode.readingDetailResponse.value.data.plan_date, '2026-09-06')
    assert.equal(mode.readingDetailResponse.value.data.book, 'gen')
    assert.equal(mode.readingDetailResponse.value.data.chapter, String(chapter))
    assert.equal(mode.getScheduleDate(), '2026-09-06')
    assert.deepEqual(mode.activeTongdokContext.value, { planId: 7, scheduleId: 101, scheduleDate: '2026-09-06' })
    assert.equal(mode.getAudioLink('gen', chapter), chapter === 3 ? 'https://example.com/audio/2026-09-07' : 'https://example.com/gen/8')
    assert.equal(mode.getGuideLink(), chapter === 3 ? 'https://example.com/guide/2026-09-07' : null)

    await mode.loadReadingDetail(7, 'gen', 2)
    assert.deepEqual(mode.getTongdokProgress('gen', 2), { ...expectedProgress, current: 2, isCurrentInRange: true })
    const completed = await mode.completeCurrentChapter('gen', 2)
    assert.equal(completed.status, 'completed')
    assert.deepEqual(completed.persistedScheduleIds, [101])
    assert.deepEqual(completed.completedScheduleIds, [101, 102])
    await mode.loadReadingDetail(7, 'gen', chapter)
    assert.equal(mode.getTongdokProgress('gen', chapter).done, 3)
    assert.equal(mode.isScheduleCompleted(), true)
    assert.equal((await mode.completeCurrentChapter('gen', chapter)).status, 'out-of-range')
    assert.equal(runtime.calls.filter(call => call[0] === 'POST').length, beforeWrites + 1)
  })
}

test('explicit schedule and plan switches reset the retained active range and local progress', async () => {
  const runtime = tongdokRuntime({ query: { tongdok: 'true', plan: '7', schedule: '101' }, get: async params => rangeDetail(params) })
  const { useTongdokMode } = await loadTongdok(runtime); const mode = useTongdokMode(); mode.initTongdokMode()
  await mode.loadReadingDetail(7, 'gen', 1)
  await mode.completeCurrentChapter('gen', 1)
  await mode.loadReadingDetail(7, 'gen', 3)
  mode.enableTongdokMode(103, 7, '2026-09-07')
  assert.equal(mode.readingDetailResponse.value, null)
  assert.equal(mode.getTongdokProgress('gen', 3), null)
  assert.equal(mode.lastCompleteCurrentResult.value, null)
  await mode.loadReadingDetail(7, 'gen', 3)
  assert.deepEqual(mode.readingDetailResponse.value.data.plan_detail.map(row => row.schedule_id), ['103'])
  assert.equal(mode.getScheduleDate(), '2026-09-07')
  assert.equal(mode.getTongdokProgress('gen', 3).done, 0)
  assert.equal((await mode.completeCurrentChapter('gen', 3)).status, 'progressed')
  mode.enableTongdokMode(201, 8, '2026-09-06')
  assert.equal(mode.readingDetailResponse.value, null)
  await mode.loadReadingDetail(8, 'gen', 1)
  assert.deepEqual(mode.readingDetailResponse.value.data.plan_detail.map(row => row.schedule_id), ['201', '202'])
  assert.equal(mode.readingDetailResponse.value.data.plan_id, '8')
  assert.equal(mode.getTongdokProgress('gen', 1).done, 0)
  assert.equal(mode.isChapterCompleted('gen', 1), false)
  assert.equal(mode.getScheduleDate(), '2026-09-06')
  mode.enableTongdokMode(101, 7, '2026-09-06')
  await mode.loadReadingDetail(7, 'gen', 1)
  assert.deepEqual(mode.readingDetailResponse.value.data.plan_detail.map(row => row.schedule_id), ['101', '102'])
  assert.equal(mode.getTongdokProgress('gen', 1).done, 0)
  mode.disableTongdokMode()
  assert.equal(mode.readingDetailResponse.value, null)
  assert.equal(mode.getTongdokProgress('gen', 1), null)
})

test('completion rejects a wrong selected identity without writing', async () => {
  const runtime = tongdokRuntime({ query: { tongdok: 'true', plan: '7', schedule: '999' }, get: async params => rangeDetail(params) })
  const { useTongdokMode } = await loadTongdok(runtime); const mode = useTongdokMode(); mode.initTongdokMode(); await mode.loadReadingDetail(7, 'gen', 1)
  assert.equal((await mode.completeCurrentChapter('gen', 1)).status, 'invalid-context')
  assert.equal(runtime.calls.some(call => call[0] === 'POST'), false)
})

test('an ambiguous chapter cannot mark or complete multiple schedule IDs', async () => {
  const rows = [
    { book: 'gen', book_kor: '창세기', start_chapter: 1, end_chapter: 1, schedule_id: 101, date: '2026-09-06', is_complete: false },
    { book: 'gen', book_kor: '창세기', start_chapter: 1, end_chapter: 1, schedule_id: 103, date: '2026-09-06', is_complete: false },
  ]
  const runtime = tongdokRuntime({ path: '/bible', query: { tongdok: 'true', plan: '7', schedule: '101' }, get: async () => detail({ chapter: 1, rows }) })
  const { useTongdokMode } = await loadTongdok(runtime); const mode = useTongdokMode(); mode.initTongdokMode(); await mode.loadReadingDetail(7, 'gen', 1)
  assert.equal(mode.markCurrentChapter('gen', 1), false)
  assert.equal((await mode.completeCurrentChapter('gen', 1)).status, 'invalid-context')
  assert.equal(runtime.calls.some(call => call[0] === 'POST'), false)
})

const componentRuntime = { Vue, Icons }; globalThis.__tongdokComponents = componentRuntime
async function loadComponent(relative) {
  const result = await build({ stdin: { contents: `export { default } from './app/${relative}';`, resolveDir: root }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', plugins: [{ name: 'component-runtime', setup(builder) {
    builder.onResolve({ filter: /^(vue|@lucide\/vue)$/ }, ({ path }) => ({ path, namespace: 'runtime' }))
    builder.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => ({ contents: Object.keys(path === 'vue' ? Vue : Icons).filter(key => key !== 'default' && /^[\w$]+$/.test(key)).map(key => `export const ${key}=globalThis.__tongdokComponents.${path === 'vue' ? 'Vue' : 'Icons'}.${key};`).join('\n') }))
    builder.onResolve({ filter: /^~\/components\/ui\/BottomSheet\.vue$/ }, () => ({ path: 'sheet', namespace: 'stub' }))
    builder.onResolve({ filter: /^~\/components\/ui\/AppButton\.vue$/ }, () => ({ path: 'button', namespace: 'stub' }))
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, ({ path }) => ({ contents: path === 'sheet' ? `import {h} from 'vue'; export default {props:['modelValue','title'],emits:['update:modelValue'],setup(p,{slots,emit}){return()=>p.modelValue?h('section',{role:'dialog','aria-label':p.title},[slots.default?.({close:()=>emit('update:modelValue',false)}),slots.footer?.({close:()=>emit('update:modelValue',false)})]):null}};` : `import {h} from 'vue'; export default {inheritAttrs:false,props:['disabled','loading'],setup(p,{slots,attrs}){return()=>h('button',{...attrs,disabled:p.disabled||p.loading||undefined},slots.default?.())}};` }))
    builder.onResolve({ filter: /^~\// }, ({ path }) => ({ path: `${root}/app/${path.slice(2)}` }))
    builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => { const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path }); assert.deepEqual(errors, []); return { contents: compileScript(descriptor, { id: path, inlineTemplate: true }).content, loader: 'ts' } })
  } }] })
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${++moduleSequence}`)).default
}
function node(type, text = '') { return Vue.markRaw({ type, text, props: {}, children: [], parent: null }) }
const renderer = Vue.createRenderer({ createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text), setText: (n, text) => { n.text = text }, setElementText: (n, text) => { n.text = text; n.children = [] }, parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null, patchProp: (n, key, _old, value) => { n.props[key] = value }, insert(n, parent, anchor = null) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = parent; const at = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(at < 0 ? parent.children.length : at, 0, n) }, remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null } })
const all = (target, predicate) => [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => all(child, predicate))]
const testId = (target, value) => all(target, child => child.props['data-testid'] === value)[0]
const renderedText = target => target.text + target.children.map(renderedText).join('')
function click(target) { assert.ok(target); assert.equal(target.props.disabled, undefined); for (const handler of [target.props.onClick].flat()) handler?.({ currentTarget: target }) }
function mount(component, props) { const host = node('root'); const app = renderer.createApp({ render: () => Vue.h(component, props) }); app.mount(host); return { host, close: () => app.unmount() } }

test('completion content renders supplied highlights and emits controlled host actions', async t => {
  const Component = await loadComponent('components/bible/ReaderCompletionContent.vue'); const events = []
  const view = mount(Component, { modalId: 'completion-1', scheduleRange: '창세기 1-2장', streak: 4, highlights: [{ id: 55, reference: '창세기 1:3', text: '빛이 있으라', color: '#FFE28A' }], nextScheduleLabel: '창세기 3-4장', onShare: () => events.push(['share']), onShareHighlight: id => events.push(['highlight', id]), onNext: () => events.push(['next']), onClose: () => events.push(['close']) }); t.after(view.close)
  assert.equal(testId(view.host, 'reader-completion-content').type, 'article'); assert.match(renderedText(view.host), /창세기 1:3/)
  click(testId(view.host, 'reader-completion-highlight-55')); click(testId(view.host, 'reader-completion-share')); click(testId(view.host, 'reader-completion-next')); click(testId(view.host, 'reader-completion-close'))
  assert.deepEqual(events, [['highlight', 55], ['share'], ['next'], ['close']])
})

test('guide and compact plan sheets emit navigation decisions to the root', async t => {
  const [Guide, Plan] = await Promise.all([loadComponent('components/bible/ReaderGuideSheet.vue'), loadComponent('components/bible/ReaderPlanSheet.vue')]); const events = []
  const guide = mount(Guide, { modelValue: true, scheduleTitle: '창세기 1-2장', guideLink: 'https://example.com/guide', onOpenGuide: url => events.push(['guide', url]) })
  const plan = mount(Plan, { modelValue: true, planName: '2026 성경통독', dateLabel: '9/6(일)', rangeLabel: '창세기 1-2장', rows: [{ scheduleId: 101, book: 'gen', chapter: 1, label: '창세기 1장', status: 'completed' }, { scheduleId: 101, book: 'gen', chapter: 2, label: '창세기 2장', status: 'current' }], nextScheduleLabel: '9/7(월) · 창세기 3-4장', onSelectChapter: value => events.push(['chapter', value]), onNextPosition: () => events.push(['next-position']) }); t.after(guide.close); t.after(plan.close)
  click(testId(guide.host, 'reader-guide-open')); click(testId(plan.host, 'reader-plan-row-101-gen-2')); click(testId(plan.host, 'reader-plan-next'))
  assert.deepEqual(events, [['guide', 'https://example.com/guide'], ['chapter', { scheduleId: 101, book: 'gen', chapter: 2 }], ['next-position']]); assert.equal(testId(plan.host, 'reader-plan-row-101-gen-2').props['aria-current'], 'step')
})
