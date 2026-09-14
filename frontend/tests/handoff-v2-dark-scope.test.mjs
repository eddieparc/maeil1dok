import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileStyle, parse } from '@vue/compiler-sfc';
import postcss from 'postcss';

for (const path of [
  'pages/login.vue',
  'pages/register-email.vue',
  'pages/account/settings.vue',
  'components/ReadingSettingsSheet.vue',
  'components/schedule/MonthSelector.vue',
]) {
  test(`${path} keeps component dark styles off the document root`, () => {
    const filename = new URL(`../app/${path}`, import.meta.url);
    const { descriptor } = parse(readFileSync(filename, 'utf8'));
    for (const style of descriptor.styles) {
      const result = compileStyle({
        source: style.content,
        filename: filename.pathname,
        id: 'data-v-dark-scope',
        scoped: style.scoped,
      });
      assert.deepEqual(result.errors, []);
      postcss.parse(result.code).walkRules(rule => {
        for (const selector of rule.selectors) {
          assert.doesNotMatch(
            selector.trim(),
            /^\[data-theme\s*=\s*["']?dark["']?\]$/,
            `Component declarations must not target html: ${rule.toString()}`,
          );
        }
      });
    }
  });
}
