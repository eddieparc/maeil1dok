import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as ServerRenderer from '@vue/server-renderer';

const root = fileURLToPath(new URL('../', import.meta.url));
globalThis.__toastHydrationRuntime = { Vue, ServerRenderer };

async function compileToast(ssr) {
  const filename = `${root}app/components/Toast.vue`;
  const { descriptor, errors } = parse(await readFile(filename, 'utf8'), {
    filename, templateParseOptions: { comments: false },
  });
  assert.deepEqual(errors, []);
  // Production removes the adapter's template comment. Compiling just the
  // client render for both passes misses the actual empty SSR output bug.
  const script = compileScript(descriptor, {
    id: 'legacy-toast-hydration', isProd: true, inlineTemplate: true,
    templateOptions: { ssr, compilerOptions: { comments: false } },
  });
  const result = await build({
    stdin: { contents: script.content, loader: 'ts', resolveDir: root },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
    plugins: [{ name: 'toast-hydration', setup(b) {
      b.onResolve({ filter: /^(vue|vue\/server-renderer)$/ }, ({ path }) => ({ path, namespace: 'runtime' }));
      b.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => {
        const key = path === 'vue' ? 'Vue' : 'ServerRenderer';
        const runtime = globalThis.__toastHydrationRuntime[key];
        return { contents: Object.keys(runtime).filter(name => name !== 'default' && /^[\w$]+$/.test(name))
          .map(name => `export const ${name} = globalThis.__toastHydrationRuntime.${key}.${name};`).join('\n') };
      });
      b.onResolve({ filter: /^~\// }, ({ path }) => ({ path: `${root}app/${path.slice(2)}.ts` }));
    } }],
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${ssr}`)).default;
}

for (const placement of ['root-tail', 'before-sibling']) {
  test(`production legacy toast preserves its hydration node at ${placement}`, async () => {
    const ServerToast = await compileToast(true);
    const ClientToast = await compileToast(false);
    const render = Toast => ServerRenderer.renderToString(Vue.createSSRApp({
      setup: () => () => Vue.h('div', [
        Vue.h('main', { class: 'bible-page is-reader' }),
        Vue.h(Toast),
        ...(placement === 'before-sibling' ? [Vue.h('nav')] : []),
      ]),
    }));
    const server = await render(ServerToast);
    const client = await render(ClientToast);
    assert.equal(server, client, 'SSR must retain the same renderless node that Vue hydrates on the client');
    assert.equal(server, `<div><main class="bible-page is-reader"></main><!---->${placement === 'before-sibling' ? '<nav></nav>' : ''}</div>`);
  });
}
