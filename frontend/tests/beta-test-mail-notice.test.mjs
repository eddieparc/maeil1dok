import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { transform } from 'esbuild'

const source = await readFile(new URL('../app/components/auth/BetaTestMailNotice.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'beta-test-mail', inlineTemplate: true })
const { code } = await transform(script.content.replaceAll(/from ['"]vue['"]/g, `from ${JSON.stringify(new URL('../node_modules/vue/dist/vue.runtime.esm-bundler.js', import.meta.url).href)}`), { loader: 'ts', format: 'esm' })
const Component = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default

for (const [mode, visible] of [[undefined, false], ['resend', false], ['beta-spool', true]]) {
  test(`test-mail notice visibility follows explicit runtime transport ${mode}`, async () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'useRuntimeConfig')
    globalThis.useRuntimeConfig = () => ({ public: { testMailTransport: mode } })
    try {
      const html = await renderToString(createSSRApp(Component))
      assert.equal(html.includes('data-testid="beta-test-mail-notice"'), visible)
      if (visible) assert.ok(html.includes('role="note"'))
    } finally {
      if (saved) Object.defineProperty(globalThis, 'useRuntimeConfig', saved)
      else delete globalThis.useRuntimeConfig
    }
  })
}
