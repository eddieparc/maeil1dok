import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import compilerSfc from '../node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js';

const { parse: parseSfc } = compilerSfc;

const landingSource = await readFile(
  new URL('../app/pages/index.vue', import.meta.url),
  'utf8',
);
const landingDescriptor = parseSfc(landingSource, { filename: 'index.vue' }).descriptor;
const scriptSetupSource = landingDescriptor.scriptSetup?.content ?? '';

test('landing shell renders SSR content immediately instead of hiding behind stylesheet-gated skeleton', () => {
  assert.doesNotMatch(scriptSetupSource, /\.landing-content\s*\{\s*opacity:\s*0;\s*\}/);
  assert.doesNotMatch(scriptSetupSource, /waitForLocalStylesheets/);
  assert.doesNotMatch(scriptSetupSource, /querySelectorAll<HTMLLinkElement>\('link\[rel="stylesheet"\]'\)/);
  assert.match(scriptSetupSource, /onMounted\(\(\) => \{\s*revealShell\(\);/);
  assert.match(scriptSetupSource, /animation:\s*landing-skeleton-timeout/);
  assert.match(scriptSetupSource, /@keyframes landing-skeleton-timeout/);
  assert.match(scriptSetupSource, /100%\s*\{\s*opacity:\s*0;\s*visibility:\s*hidden;/);
});
