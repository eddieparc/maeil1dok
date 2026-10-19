import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { build } from 'esbuild';
import { compileScript, compileStyle, parse } from '@vue/compiler-sfc';
import { expect, test } from './fixtures/api';

let bundle = '';
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import { createApp, h } from 'vue';
      import Common from './app/components/common/LoadingSpinner.vue';
      import UI from './app/components/ui/LoadingSpinner.vue';
      import State from './app/components/LoadingState.vue';
      import Empty from './app/components/ui/EmptyState.vue';
      createApp({render: () => h('div', [
        ...[[Common, {}], [Common, {fullScreen:true}], [UI, {}], [UI, {inline:true,size:18}], [UI, {fullscreen:true}], [State, {}]].map(([component, props], i) => h(component, {...props, 'data-testid':'spinner-'+i})),
        h(Empty, {title:'', text:'fallback', hint:'hint', guide:['first','second'], actionText:'act', onAction: () => document.body.dataset.acted='true', 'data-testid':'empty'}),
        h(Empty, {text:'slots', 'data-testid':'slots'}, {icon:()=>h('svg', {'data-testid':'custom-icon'}), guide:()=>h('div', {'data-testid':'custom-guide'}), action:()=>h('button', {'data-testid':'custom-action'})})
      ])}).mount('#feedback-fixture');`, resolveDir: process.cwd(), loader: 'js' },
    bundle: true, write: false, format: 'iife', platform: 'browser',
    define: { 'process.env.NODE_ENV': '"test"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
    plugins: [{ name: 'feedback-sfc', setup(builder) {
      builder.onResolve({ filter: /^#components$/ }, () => ({ path: 'nuxt', namespace: 'stub' }));
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: "export const NuxtLink = 'a'" }));
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const source = await readFile(path, 'utf8');
        const { descriptor } = parse(source, { filename: path });
        const id = 'feedback-' + path.split('/').slice(-2).join('-').replace(/\./g, '-');
        const script = compileScript(descriptor, { id, inlineTemplate: true });
        const css = descriptor.styles.map(style => compileStyle({ source: style.content, filename: path, id: `data-v-${id}`, scoped: false }).code).join('\n');
        return { contents: `${script.content}\nconst style = document.createElement('style'); style.textContent=${JSON.stringify(css)}; document.head.append(style);`, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  bundle = result.outputFiles.map(file => file.text).join('\n');
});

test('feedback adapters preserve placement, status, sizes and empty interfaces when mounted', async ({ page }) => {
  // Given: a real subpage with the shipped feedback components mounted alongside it.
  await page.goto('/bible/search');
  await expect(page.locator('.bible-subpage')).toBeVisible();
  await page.evaluate(() => { const root = document.createElement('div'); root.id = 'feedback-fixture'; document.body.append(root); });
  // When: the actual components render their legacy interfaces.
  await page.addScriptTag({ content: bundle });
  // Then: one status per spinner, decorative geometry, distinct legacy placements.
  await expect(page.locator('#feedback-fixture [role="status"]')).toHaveCount(6);
  for (let i = 0; i < 6; i++) await expect(page.getByTestId(`spinner-${i}`).locator('[aria-hidden="true"]')).toHaveCount(1);
  await expect(page.getByTestId('spinner-1')).toHaveCSS('position', 'fixed');
  await expect(page.getByTestId('spinner-4')).not.toHaveCSS('position', 'fixed');
  await expect(page.getByTestId('spinner-3').locator('[aria-hidden="true"]')).toHaveCSS('width', '18px');
  await expect(page.getByTestId('spinner-5').locator('[aria-hidden="true"]')).toHaveCSS('width', '40px');
  await expect(page.getByTestId('empty').locator('h3')).toHaveText('');
  await expect(page.getByTestId('empty').locator('li')).toHaveCount(2);
  await expect(page.getByTestId('custom-icon')).toHaveCount(1);
  await expect(page.getByTestId('custom-guide')).toHaveCount(1);
  await expect(page.getByTestId('custom-action')).toHaveCount(1);
});

test('record subpage exposes a login action when records require authentication', async ({ page }) => {
  // Given: a signed-out reader.
  // When: opening the existing records surface.
  await page.goto('/bible/highlights');
  // Then: the canonical empty presentation offers the actual login destination.
  await expect(page.locator('.bible-subpage .empty-state')).toBeVisible();
  await expect(page.locator('.empty-action a')).toHaveAttribute('href', '/login');
});

test('feedback action emits when clicked and reduced motion stops rotation', async ({ page }) => {
  // Given: reduced motion and the adapter action.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/bible/search');
  await page.evaluate(() => { const root = document.createElement('div'); root.id = 'feedback-fixture'; document.body.append(root); });
  await page.addScriptTag({ content: bundle });
  await page.getByTestId('spinner-1').evaluate(element => element.remove());
  // When: the adapter's default action is activated.
  await page.getByTestId('empty').getByRole('button').click();
  // Then: the event reaches its consumer and spinners remain static.
  await expect(page.locator('body')).toHaveAttribute('data-acted', 'true');
  await expect(page.getByTestId('spinner-0').locator('[aria-hidden="true"]')).toHaveCSS('animation-name', 'none');
});
