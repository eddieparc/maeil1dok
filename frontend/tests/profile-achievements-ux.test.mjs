import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';

const achievementsSource = await readFile(
  new URL('../app/components/profile/ProfileAchievements.vue', import.meta.url),
  'utf8',
);

const vueRuntimeExports = Object.keys(Vue)
  .filter(name => /^[A-Za-z_$][\w$]*$/.test(name) && name !== 'default')
  .map(name => `export const ${name} = globalThis.__achievementsVueRuntime.${name};`)
  .join('\n');

globalThis.__achievementsVueRuntime = Vue;
globalThis.computed = Vue.computed;
globalThis.ref = Vue.ref;

async function compileAchievementsComponent() {
  const { descriptor, errors } = parse(achievementsSource, {
    filename: 'ProfileAchievements.vue',
  });
  assert.deepEqual(errors, [], 'ProfileAchievements.vue should parse');

  const compiled = compileScript(descriptor, {
    id: 'profile-achievements-contract',
    inlineTemplate: true,
  });
  const result = await build({
    stdin: {
      contents: compiled.content,
      loader: 'ts',
      resolveDir: new URL('../app/components/profile/', import.meta.url).pathname,
      sourcefile: 'ProfileAchievements.vue',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'profile-achievements-ssr-stubs',
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^vue$/ }, () => ({
            path: 'vue',
            namespace: 'achievements-vue',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'achievements-vue' }, () => ({
            contents: vueRuntimeExports,
          }));
          pluginBuild.onResolve({ filter: /^@lucide\/vue$/ }, () => ({
            path: 'lucide',
            namespace: 'achievements-lucide',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'achievements-lucide' }, () => ({
            contents: `
              import { h } from 'vue';
              const Icon = (_props, { attrs }) => h('svg', attrs);
              export {
                Icon as AwardIcon,
                Icon as BookOpenIcon,
                Icon as CalendarCheckIcon,
                Icon as FlameIcon,
                Icon as LockIcon,
                Icon as StarIcon,
                Icon as TrophyIcon,
              };
            `,
          }));
          pluginBuild.onResolve({ filter: /\.vue$/ }, ({ path }) => ({
            path,
            namespace: 'achievements-component',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'achievements-component' }, () => ({
            contents: 'export default () => null;',
          }));
        },
      },
    ],
  });

  const dataUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`;
  return (await import(dataUrl)).default;
}

const ProfileAchievements = await compileAchievementsComponent();
const achievementsData = [
  {
    id: null,
    achievement_type: 'reading_books',
    title: '첫 통독',
    description: '성경 세 권 읽기',
    icon: 'book',
    order: 1,
    unlocked: false,
    unlockedAt: null,
    milestone_value: 3,
  },
  {
    id: 2,
    achievement_type: 'reading_streak',
    title: '꾸준한 일독',
    description: '일주일 연속 통독',
    icon: 'fire',
    order: 2,
    unlocked: true,
    unlockedAt: '2026-01-02T00:00:00Z',
    milestone_value: 7,
  },
  {
    id: null,
    achievement_type: 'hasena_streak',
    title: '묵상의 시작',
    description: '하세나를 이어가기',
    icon: 'fire',
    order: 3,
    unlocked: false,
    unlockedAt: null,
    milestone_value: 5,
  },
];

const achievementsHtml = await renderToString(Vue.createSSRApp({
  render: () => Vue.h(ProfileAchievements, {
    achievementsData,
    plans: [{ id: 11, name: '창세기 플랜' }],
  }),
}));

test('profile achievements are grouped into expected achievement sections', () => {
  assert.match(achievementsHtml, /<section[^>]*aria-label="통독 업적"/);
  assert.match(achievementsHtml, /<section[^>]*aria-label="연속 업적"/);
  assert.match(achievementsHtml, /<span>성경통독<\/span><strong>1 \/ 2<\/strong>/);
  assert.match(achievementsHtml, /<span>하세나<\/span><strong>0 \/ 1<\/strong>/);
});

test('locked achievement cards show target and next-step cues', () => {
  assert.match(achievementsHtml, />잠김<\/p>/);
  assert.match(achievementsHtml, />목표 3권까지 필요<\/p>/);
  assert.match(achievementsHtml, />통독 완료를 쌓으면 잠금 해제됩니다\.<\/p>/);
  assert.match(achievementsHtml, />2026\.01\.02<\/div>/);
});

test('achievement locked state is accessible to assistive technology', () => {
  assert.match(achievementsHtml, /role="list"/);
  assert.match(achievementsHtml, /role="listitem" aria-disabled="true" aria-label="첫 통독, 잠김, 목표 3권"/);
  assert.match(achievementsHtml, /role="listitem" aria-disabled="false" aria-label="꾸준한 일독, 달성"/);
  assert.match(achievementsHtml, /aria-describedby="achievement-reading_books"/);
});

test('profile achievements use Bible-plan and Hasena tabs instead of one long mixed wall', () => {
  assert.match(achievementsHtml, /role="tablist" aria-label="업적 종류"/);
  assert.match(achievementsHtml, /id="achievement-tab-bible"[^>]*aria-selected="true"/);
  assert.match(achievementsHtml, /id="achievement-tab-hasena"[^>]*aria-selected="false"/);
  assert.match(achievementsHtml, /role="tablist" aria-label="성경통독 플랜"/);
  assert.match(achievementsHtml, />전체 플랜<\/button>/);
  assert.match(achievementsHtml, />창세기 플랜<\/button>/);
});
