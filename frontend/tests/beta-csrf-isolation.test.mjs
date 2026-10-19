import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { build, transform } from 'esbuild'
import 'vue'

// Bundle only the affected modules in memory, not Nuxt or its frozen QA output.
const result = await build({
  stdin: {
    contents: `export { useApi } from './app/composables/useApi'; export { useAuthService } from './app/composables/useAuthService'`,
    resolveDir: new URL('..', import.meta.url).pathname,
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm',
  alias: { '~': new URL('../app', import.meta.url).pathname },
  define: { 'import.meta.server': 'false', 'import.meta.client': 'false' },
  plugins: [{ name: 'nuxt-runtime-only', setup(builder) {
    builder.onResolve({ filter: /^#app$/ }, args => ({ path: args.path, namespace: 'runtime' }))
    builder.onResolve({ filter: /^vue$/ }, () => ({ path: new URL('../node_modules/vue/dist/vue.runtime.esm-bundler.js', import.meta.url).href, external: true }))
    builder.onLoad({ filter: /.*/, namespace: 'runtime' }, () => ({ contents: 'export const useRuntimeConfig = () => globalThis.useRuntimeConfig()' }))
  } }],
})
const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
let sequence = 0

test('Nuxt runtime config declares primary default and accepts the beta override', async () => {
  const source = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
  const { code } = await transform(`const defineNuxtConfig = config => config;\n${source}`, { loader: 'ts', format: 'esm' })
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  const previous = process.env.NUXT_PUBLIC_CSRF_COOKIE_NAME
  try {
    delete process.env.NUXT_PUBLIC_CSRF_COOKIE_NAME
    const primary = (await import(`${url}#primary`)).default
    assert.equal(primary.runtimeConfig.public.csrfCookieName, 'csrftoken')
    process.env.NUXT_PUBLIC_CSRF_COOKIE_NAME = 'beta_csrftoken'
    const beta = (await import(`${url}#beta`)).default
    assert.equal(beta.runtimeConfig.public.csrfCookieName, 'beta_csrftoken')
  } finally {
    if (previous === undefined) delete process.env.NUXT_PUBLIC_CSRF_COOKIE_NAME
    else process.env.NUXT_PUBLIC_CSRF_COOKIE_NAME = previous
  }
})

async function environment(cookieName, cookie, run) {
  const keys = ['window', 'document', 'localStorage', 'useRuntimeConfig', 'useState', 'fetch']
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  const store = new Map()
  const states = new Map([['auth:state', { value: 'authenticated' }]])
  const calls = []
  const responses = []
  Object.assign(globalThis, {
    window: {}, document: { cookie },
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    useRuntimeConfig: () => ({ public: { apiBase: 'https://beta.test', ...(cookieName ? { csrfCookieName: cookieName } : {}) } }),
    useState: (key, init) => { if (!states.has(key)) states.set(key, { value: init() }); return states.get(key) },
    fetch: async (url, options) => {
      calls.push({ url, ...options, headers: { ...options.headers } })
      assert.ok(responses.length, `unexpected fetch ${url}`)
      return responses.shift()
    },
  })
  try {
    const modules = await import(`${moduleUrl}#${++sequence}`)
    await run({ ...modules, store, calls, responses })
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
}
const response = (body = {}, status = 200, token) => new Response(JSON.stringify(body), {
  status, headers: token ? { 'X-CSRFToken': token } : {},
})

for (const [name, cookie, expected] of [
  [undefined, 'beta_csrftoken=beta; csrftoken=primary', 'primary'],
  ['beta_csrftoken', 'csrftoken=primary; beta_csrftoken=beta', 'beta'],
  ['beta_csrftoken', 'other_beta_csrftoken=wrong; beta_csrftoken = exact', 'exact'],
  ['beta_csrftoken', 'csrftoken=primary; other_beta_csrftoken=wrong', undefined],
  ['beta_csrftoken', 'beta_csrftoken=; csrftoken=primary', undefined],
  ['beta_csrftoken', 'beta_csrftoken=opaque%2Bvalue==', 'opaque%2Bvalue=='],
]) {
  test(`exact CSRF selection ${name ?? 'default'}: ${cookie}`, async () => {
    await environment(name, cookie, async ({ useApi, useAuthService, calls, responses }) => {
      responses.push(response(), response({ access: 'renewed' }))
      await useApi().POST('/api/v1/auth/email-login/', {})
      await useAuthService().refreshToken()
      assert.deepEqual(calls.map(call => call.headers['X-CSRFToken']), [expected, expected])
      assert.ok(calls.every(call => call.credentials === 'include'))
    })
  })
}

test('beta ignores legacy stored token and recovery replaces only its scoped token', async () => {
  await environment('beta_csrftoken', 'csrftoken=primary; beta_csrftoken=beta-cookie', async ({ useApi, useAuthService, store, responses, calls }) => {
    store.set('csrfToken', 'old-production-backed-beta')
    responses.push(response({}, 403), response({ csrfToken: 'recovered-beta' }), response({ access: 'renewed' }), response({}, 200, 'header-beta'), response())
    assert.deepEqual(await useAuthService().refreshToken(), { ok: true })
    await useApi().POST('/api/v1/auth/email-login/', {})
    await useApi().POST('/api/v1/auth/email-login/', {})
    assert.deepEqual(calls.map(call => call.headers['X-CSRFToken']), ['beta-cookie', undefined, 'recovered-beta', 'recovered-beta', 'header-beta'])
    assert.equal(store.get('csrfToken'), 'old-production-backed-beta')
    assert.equal(store.get('csrfToken:beta_csrftoken'), 'header-beta')
    assert.equal(calls[1].url, 'https://beta.test/api/v1/auth/csrf/')
  })
})

test('primary keeps stored-token precedence and header storage contract', async () => {
  await environment(undefined, 'csrftoken=cookie', async ({ useApi, store, responses, calls }) => {
    store.set('csrfToken', 'stored')
    responses.push(response({}, 200, 'header'), response())
    await useApi().POST('/api/v1/auth/email-login/', {})
    await useApi().POST('/api/v1/auth/email-login/', {})
    assert.deepEqual(calls.map(call => call.headers['X-CSRFToken']), ['stored', 'header'])
    assert.equal(store.get('csrfToken'), 'header')
  })
})
