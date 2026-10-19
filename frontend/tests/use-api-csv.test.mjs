import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'
import ts from 'typescript'

const appDir = fileURLToPath(new URL('../app/', import.meta.url))
const exportPath = '/api/v1/admin/members/export.csv'
const options = { timeout: 10000 }

// Type-check the actual facade and generated contract without Nuxt generation.
// Only the Nuxt/auth runtime boundaries are supplied; response types are real.
test('generated CSV infers string through ApiResponseBody and the actual GET facade', options, () => {
  const fixturePath = `${appDir}api-csv-type-test.ts`
  const boundaryPath = `${appDir}api-csv-runtime-boundary.d.ts`
  const files = new Map([
    [fixturePath, `
      import { useApi } from './composables/useApi'
      import type { ApiResponseBody } from './types/api-contract'
      import type { components, operations } from './types/generated/api-schema'
      type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
        (<T>() => T extends B ? 1 : 2) ? true : false
      type Assert<T extends true> = T
      type Csv = ApiResponseBody<'${exportPath}', 'get'>
      type CsvIsString = Assert<Equal<Csv, string>>
      type CsvIsGenerated = Assert<Equal<Csv,
        operations['admin_members_export.csv_retrieve']['responses'][200]['content']['text/csv']>>
      type JsonIsUnchanged = Assert<Equal<ApiResponseBody<'/api/v1/admin/members/', 'get'>,
        components['schemas']['MemberList']>>
      async function exportMembers() {
        const result = await useApi().GET('${exportPath}', {
          params: { q: '#7', filter: 'staff', sort: 'streak', masked: true },
        })
        type FacadeIsString = Assert<Equal<typeof result.data, string>>
        return result.data.split('\\r\\n')
      }
    `],
    [boundaryPath, `
      export function useRuntimeConfig(): {
        internalApiBase?: string; public: { apiBase: string; csrfCookieName?: string }
      }
      export function useAuthService(): {
        isAuthenticated: { value: boolean }; isInitialized: { value: boolean };
        isLoading: { value: boolean }; initialize(): Promise<void>; logout(): void;
        refreshToken(options: { logoutOnFailure: boolean }): Promise<boolean | { ok: boolean; reason?: string }>
      }
      declare global {
        interface ImportMeta { server: boolean }
        interface Window { isReactNativeWebView?: boolean }
      }
    `],
  ])
  const compilerOptions = {
    strict: true, noEmit: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [], baseUrl: appDir, paths: { '~/*': ['./*'] },
  }
  const host = ts.createCompilerHost(compilerOptions)
  const readFile = host.readFile.bind(host), fileExists = host.fileExists.bind(host)
  host.readFile = path => files.get(path) ?? readFile(path)
  host.fileExists = path => files.has(path) || fileExists(path)
  host.resolveModuleNames = (names, containingFile) => names.map(name =>
    ['#app', '~/composables/useAuthService'].includes(name)
      ? { resolvedFileName: boundaryPath, extension: ts.Extension.Dts }
      : ts.resolveModuleName(name, containingFile, compilerOptions, host).resolvedModule)
  const program = ts.createProgram([fixturePath], compilerOptions, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => appDir, getCanonicalFileName: path => path, getNewLine: () => '\n',
  }))
})

const built = await build({
  entryPoints: [`${appDir}composables/useApi.ts`], bundle: true, write: false,
  platform: 'node', format: 'cjs', alias: { '~': appDir },
  define: { 'import.meta.server': 'false' },
  plugins: [{ name: 'runtime-boundaries', setup(builder) {
    builder.onResolve({ filter: /^(#app|~\/composables\/useAuthService)$/ }, ({ path }) => ({ path, external: true }))
  } }],
})
const require = createRequire(import.meta.url)
function environment(t, responses, refreshOutcome = { ok: true }) {
  const store = new Map([['csrfToken', 'primary-token']]), calls = [], refreshCalls = []
  let logoutCount = 0
  const auth = {
    isAuthenticated: { value: true }, isInitialized: { value: true }, isLoading: { value: false },
    initialize: async () => {},
    refreshToken: async config => { refreshCalls.push(config); return refreshOutcome },
    logout: () => { logoutCount++; auth.isAuthenticated.value = false },
  }
  for (const [key, value] of Object.entries({
    window: {}, document: { cookie: 'csrftoken=primary; beta_csrftoken=beta-cookie' },
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key])
  }
  const queue = [...responses]
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, ...init, headers: { ...init.headers } })
    assert.ok(queue.length, `Unexpected fetch: ${url}`)
    const response = queue.shift()
    assert.ok(response instanceof Response, 'transport must supply an actual Response')
    return response
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', built.outputFiles[0].text)(name => {
    if (name === '#app') return { useRuntimeConfig: () => ({ public: { apiBase: 'https://api.example.test', csrfCookieName: 'beta_csrftoken' } }) }
    if (name === '~/composables/useAuthService') return { useAuthService: () => auth }
    return require(name)
  }, module, module.exports)
  return { api: module.exports.useApi(), store, calls, refreshCalls, auth, get logoutCount() { return logoutCount } }
}
const csv = 'id,nickname\r\n7,"fixture,quoted"\r\n'
for (const contentType of ['text/csv', 'text/csv; charset=utf-8', 'Text/CSV ; charset=UTF-8']) {
  test(`GET decodes actual CSV as text (${contentType})`, options, async t => {
    const response = new Response(`\uFEFF${csv}`, { headers: { 'Content-Type': contentType, 'X-CSRFToken': 'beta-header' } })
    const { api, calls, store } = environment(t, [response])
    const result = await api.GET(exportPath, { params: { q: '#7', filter: 'staff', sort: 'streak', masked: false } })
    assert.deepEqual(result, { data: csv })
    assert.equal(response.bodyUsed, true)
    assert.equal(calls.length, 1)
    assert.deepEqual(Object.fromEntries(new URL(calls[0].url).searchParams), { q: '#7', filter: 'staff', sort: 'streak', masked: 'false' })
    assert.equal(calls[0].credentials, 'include')
    assert.deepEqual(calls[0].headers, { 'Content-Type': 'application/json', 'X-Client': 'web', 'X-App-Platform': 'web' })
    assert.equal(store.get('csrfToken'), 'primary-token')
    assert.equal(store.get('csrfToken:beta_csrftoken'), 'beta-header')
  })
}
test('an empty 200 CSV body is an empty string, not a JSON parse failure', options, async t => {
  const { api } = environment(t, [new Response('', { headers: { 'Content-Type': 'text/csv' } })])
  assert.deepEqual(await api.GET(exportPath), { data: '' })
})
for (const contentType of [undefined, 'application/json', 'application/problem+json']) {
  test(`GET retains JSON parsing (${contentType ?? 'no content type'})`, options, async t => {
    const response = new Response(JSON.stringify({ count: 0, results: [] }))
    response.headers.delete('Content-Type')
    if (contentType) response.headers.set('Content-Type', contentType)
    const { api } = environment(t, [response])
    assert.deepEqual(await api.GET('/api/v1/admin/members/'), { data: { count: 0, results: [] } })
  })
}
for (const [contentType, body] of [
  ['text/html', '<html>upstream failure</html>'],
  ['text/plain', csv], ['text/csv-fake', csv], ['application/json', '{invalid'],
]) {
  test(`GET does not accept non-CSV invalid JSON (${contentType})`, options, async t => {
    const { api } = environment(t, [new Response(body, { headers: { 'Content-Type': contentType } })])
    await assert.rejects(api.GET('/api/v1/admin/members/'), SyntaxError)
  })
}
for (const status of [204, 205]) {
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    test(`${method} retains null for actual ${status} even with a CSV header`, options, async t => {
      const { api } = environment(t, [new Response(null, { status, headers: { 'Content-Type': 'text/csv' } })])
      const result = await api[method]('/api/v1/admin/members/', {})
      assert.deepEqual(result, method === 'GET' ? { data: null } : null)
    })
  }
}
for (const [status, contentType, body, data, message] of [
  [403, 'application/json', '{"detail":"forbidden","code":"staff_required"}', { detail: 'forbidden', code: 'staff_required' }, 'forbidden'],
  [500, 'text/html', '<html>upstream failure</html>', null, 'API request failed: 500'],
  [400, 'text/csv', csv, null, 'API request failed: 400'],
]) {
  test(`CSV export preserves HTTP ${status} error handling (${contentType})`, options, async t => {
    const { api, calls } = environment(t, [new Response(body, { status, headers: { 'Content-Type': contentType } })])
    await assert.rejects(api.GET(exportPath), error => {
      assert.equal(error.name, 'ApiError'); assert.equal(error.status, status)
      assert.equal(error.message, message); assert.deepEqual(error.data, data)
      return true
    })
    assert.equal(calls.length, 1)
  })
}
test('CSV success after 401 uses the shared refresh, retry headers, cookies and scoped token storage', options, async t => {
  const { api, calls, refreshCalls, store } = environment(t, [
    new Response('{}', { status: 401, headers: { 'X-CSRFToken': 'first-beta' } }),
    new Response(csv, { headers: { 'Content-Type': 'text/csv', 'X-CSRFToken': 'retry-beta' } }),
  ])
  assert.deepEqual(await api.GET(exportPath), { data: csv })
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[1], calls[0])
  assert.equal(calls[1].credentials, 'include')
  assert.deepEqual(refreshCalls, [{ logoutOnFailure: false }])
  assert.equal(store.get('csrfToken:beta_csrftoken'), 'retry-beta')
  assert.equal(store.get('csrfToken'), 'primary-token')
})
for (const reason of ['unreachable', 'rejected']) {
  test(`CSV export does not retry a ${reason} refresh`, options, async t => {
    const env = environment(t, [new Response('{}', { status: 401 })], { ok: false, reason })
    await assert.rejects(env.api.GET(exportPath), error => error.name === 'ApiError' && error.status === 401)
    assert.equal(env.calls.length, 1)
    assert.equal(env.logoutCount, reason === 'rejected' ? 1 : 0)
    assert.equal(env.auth.isAuthenticated.value, reason === 'unreachable')
  })
}
