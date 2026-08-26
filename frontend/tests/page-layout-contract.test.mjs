import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import { test } from 'node:test';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import { computed, createSSRApp, defineComponent, h, useSlots } from 'vue';
import { renderToString } from '@vue/server-renderer';

const pagesRoot = new URL('../app/pages/', import.meta.url);

async function collectVueFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const childUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directoryUrl);
    if (entry.isDirectory()) {
      files.push(...await collectVueFiles(childUrl));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.vue')) {
      files.push(childUrl);
    }
  }

  return files;
}

function routePathFor(fileUrl) {
  const relativePath = relative(pagesRoot.pathname, fileUrl.pathname);
  const withoutExtension = relativePath.replace(/\.vue$/, '');
  const segments = withoutExtension.split(sep);

  if (segments.at(-1) === 'index') {
    segments.pop();
  }

  return `/${segments.join('/')}`.replace(/\/$/, '') || '/';
}

const pageSources = await Promise.all(
  (await collectVueFiles(pagesRoot)).map(async (fileUrl) => ({
    routePath: routePathFor(fileUrl),
    source: await readFile(fileUrl, 'utf8'),
  })),
);

const pageHeaderSource = await readFile(
  new URL('../app/components/PageHeader.vue', import.meta.url),
  'utf8',
);
const pageLayoutSource = await readFile(
  new URL('../app/components/common/PageLayout.vue', import.meta.url),
  'utf8',
);

const managedRoutePrefixes = [
  '/admin',
  '/company',
  '/friends',
  '/hasena',
  '/install',
  '/intro',
  '/notice',
  '/plan',
  '/plans',
  '/privacy',
  '/support',
  '/terms',
];

test('non-bible app pages use PageLayout so headers and floating nav stay consistent', () => {
  const offenders = pageSources
    .filter(({ routePath }) => managedRoutePrefixes.some(prefix => routePath === prefix || routePath.startsWith(`${prefix}/`)))
    .filter(({ routePath }) => !routePath.startsWith('/bible'))
    .filter(({ source }) => source.includes('<PageHeader'))
    .filter(({ source }) => !source.includes('<PageLayout'))
    .map(({ routePath }) => routePath);

  assert.deepEqual(offenders, []);
});

test('managed PageLayout pages do not keep stale root container or header styles', () => {
  const offenders = pageSources
    .filter(({ routePath }) => managedRoutePrefixes.some(prefix => routePath === prefix || routePath.startsWith(`${prefix}/`)))
    .filter(({ routePath }) => !routePath.startsWith('/bible'))
    .filter(({ source }) => source.includes('<PageLayout'))
    .flatMap(({ routePath, source }) => {
      const styleBlock = source.match(/<style scoped>[\s\S]*?<\/style>/)?.[0] ?? '';
      const staleSelectors = [
        /^\s*\.container\s*\{/m,
        /^\s*\.header\s*\{/m,
        /^\s*\.header\s+h1\s*\{/m,
        /^\s*\.fixed-area\s*\{/m,
        /^\s*\[data-theme="dark"\]\s+\.container\s*\{/m,
      ];

      return staleSelectors
        .filter(selector => selector.test(styleBlock))
        .map(selector => `${routePath}: ${selector}`);
    });

  assert.deepEqual(offenders, []);
});

test('bible routes keep their dedicated reader header exception', () => {
  const bibleSettings = pageSources.find(({ routePath }) => routePath === '/bible/settings');
  const bibleHeaderOffenders = pageSources
    .filter(({ routePath }) => routePath === '/bible' || routePath.startsWith('/bible/'))
    .filter(({ source }) => source.includes('<PageLayout') || source.includes('<PageHeader'))
    .map(({ routePath }) => routePath);

  assert.ok(bibleSettings, 'reading settings page should exist');
  assert.doesNotMatch(bibleSettings.source, /<PageLayout/);
  assert.deepEqual(bibleHeaderOffenders, []);
});

test('shared PageHeader follows the reading settings header treatment', () => {
  const headerBlock = pageHeaderSource.match(/\.header\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  const backButtonBlock = pageHeaderSource.match(/\.back-button\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.doesNotMatch(headerBlock, /box-shadow/);
  assert.doesNotMatch(backButtonBlock, /min-width:\s*44px/);
});

test('PageLayout preserves PageHeader notification fallback when no custom action exists', async () => {
  const { descriptor } = parse(pageLayoutSource, { filename: 'PageLayout.vue' });
  assert.ok(descriptor.template, 'PageLayout should have a template');

  const compiled = compileTemplate({
    id: 'page-layout-contract',
    source: descriptor.template.content,
    filename: 'PageLayout.vue',
    compilerOptions: {
      mode: 'function',
    },
  });

  assert.equal(compiled.errors.length, 0);

  const render = new Function('Vue', `${compiled.code}; return render`)(Vue);

  const PageHeaderStub = defineComponent({
    name: 'PageHeader',
    setup(_, { slots }) {
      return () => h(
        'header',
        { class: 'page-header-stub' },
        slots.right ? slots.right() : h('a', { class: 'notification-link' }, '알림'),
      );
    },
  });

  const layoutComponent = defineComponent({
    name: 'PageLayoutUnderTest',
    components: {
      PageHeader: PageHeaderStub,
      FloatingNav: defineComponent({ name: 'FloatingNav', setup: () => () => h('nav', { class: 'floating-nav' }) }),
    },
    props: {
      title: { type: String, required: true },
      showBackButton: { type: Boolean, default: true },
      fallbackPath: { type: String, default: '/' },
      onBack: { type: Function, default: null },
      scrollAreaClass: { type: String, default: '' },
      showFloatingNav: { type: Boolean, default: true },
    },
    setup(props) {
      const slots = useSlots();
      const hasHeaderAction = computed(() => Boolean(slots['header-action']));
      return { ...props, hasHeaderAction };
    },
    render,
  });

  const withoutCustomAction = await renderToString(createSSRApp({
    render: () => h(layoutComponent, { title: '회사정보' }, { default: () => h('main', 'content') }),
  }));
  const withCustomAction = await renderToString(createSSRApp({
    render: () => h(
      layoutComponent,
      { title: '성경통독표' },
      {
        default: () => h('main', 'content'),
        'header-action': () => h('button', { class: 'edit-mode-button' }, '일괄수정'),
      },
    ),
  }));

  assert.match(withoutCustomAction, /notification-link/);
  assert.doesNotMatch(withoutCustomAction, /edit-mode-button/);
  assert.match(withCustomAction, /edit-mode-button/);
  assert.doesNotMatch(withCustomAction, /notification-link/);
});
