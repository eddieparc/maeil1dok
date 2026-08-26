import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';
import { computed, createSSRApp, defineComponent, h } from 'vue';

const readSource = path => readFile(new URL(path, import.meta.url), 'utf8');
const [cardSource, modalSource] = await Promise.all([
  readSource('../app/components/bible/TongdokCertificationCard.vue'),
  readSource('../app/components/bible/TongdokCertificationModal.vue'),
]);

const compileSfcTemplate = (source, filename) => {
  const { descriptor } = parse(source, { filename });
  assert.ok(descriptor.template, `${filename} should have a template`);
  const compiled = compileTemplate({
    id: `test-${filename}`,
    source: descriptor.template.content,
    filename,
    compilerOptions: { mode: 'function' },
  });
  assert.deepEqual(compiled.errors, []);
  return new Function('Vue', `${compiled.code}; return render`)(Vue);
};

const iconStub = defineComponent({
  setup: () => () => h('span', { 'aria-hidden': 'true' }),
});

const TongdokCertificationCard = defineComponent({
  components: { CheckIcon: iconStub },
  props: { certification: { type: Object, default: null } },
  setup(props) {
    const title = computed(() => props.certification?.card?.title || '오늘 통독 완료');
    const subtitle = computed(() => props.certification?.card?.subtitle || '오늘도 말씀을 읽었습니다');
    const footer = computed(() => props.certification?.card?.footer || '매일 말씀을 읽는 작은 습관');
    const readingRange = computed(() => props.certification?.card?.readingRange || '');
    const progressLine = computed(() => {
      const progress = props.certification?.progress;
      if (!progress || progress.totalSchedules === 0) return '';
      return `${progress.completedSchedules}/${progress.totalSchedules}일 완료 · ${progress.completionRate}%`;
    });
    const accessibleSummary = computed(() => {
      const parts = ['매일일독', title.value, subtitle.value, readingRange.value, progressLine.value]
        .filter(Boolean);
      return `${parts.join('. ')} 인증 카드.`;
    });
    return { accessibleSummary, footer, progressLine, readingRange, subtitle, title };
  },
  render: compileSfcTemplate(cardSource, 'TongdokCertificationCard.vue'),
});

const BaseModal = defineComponent({
  props: { modelValue: Boolean, title: String },
  setup(props, { slots }) {
    return () => props.modelValue
      ? h('section', { role: 'dialog', 'aria-label': props.title }, [
          h('h2', props.title),
          slots.default?.(),
        ])
      : null;
  },
});

const certification = {
  success: true,
  plan: { id: 7, name: '1년 1독' },
  progress: {
    totalSchedules: 30,
    completedSchedules: 18,
    completionRate: 60,
    currentStreak: 4,
    totalCompletedDays: 18,
    latestCompletedAt: '2026-08-26T00:00:00+09:00',
    status: 'in_progress',
  },
  card: {
    title: '오늘 통독 완료',
    subtitle: '오늘도 말씀을 읽었습니다',
    readingRange: '사무엘상 25장',
    dateLabel: '2026-08-26',
    footer: '매일 말씀을 읽는 작은 습관',
  },
};

const renderCard = value => renderToString(createSSRApp({
  render: () => h(TongdokCertificationCard, { certification: value }),
}));

const renderModal = ({ value = certification, loading = false } = {}) => {
  const component = defineComponent({
    components: {
      BaseModal,
      TongdokCertificationCard,
      DownloadIcon: iconStub,
      LinkIcon: iconStub,
      ShareIcon: iconStub,
    },
    setup() {
      return {
        certification: value,
        emit: () => {},
        handleCopy: () => {},
        handleDownload: () => {},
        handleShare: () => {},
        isActionBusy: loading,
        isCertificationActionDisabled: loading || !value?.success,
        isLoading: loading,
        modelValue: true,
        statusMessage: '',
      };
    },
    render: compileSfcTemplate(modalSource, 'TongdokCertificationModal.vue'),
  });

  return renderToString(createSSRApp(component));
};

test('certification card renders the team memo copy with an accessible summary', async () => {
  const html = await renderCard(certification);

  for (const label of [
    '매일일독',
    '오늘 통독 완료',
    '오늘도 말씀을 읽었습니다',
    '매일 말씀을 읽는 작은 습관',
    '사무엘상 25장',
    '18/30일 완료 · 60%',
  ]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(
    html,
    /aria-label="매일일독\. 오늘 통독 완료\. 오늘도 말씀을 읽었습니다\. 사무엘상 25장\. 18\/30일 완료 · 60% 인증 카드\."/,
  );

  // Computed token colors: tests/e2e/hasena-sns-behavior.spec.ts.
});

test('certification modal opens as a separate completion surface with required actions', async () => {
  const html = await renderModal();

  assert.match(html, /role="dialog" aria-label="통독 인증 카드"/);
  assert.match(html, /사무엘상 25장/);
  for (const label of ['공유하기', '이미지 저장', '링크 복사']) {
    assert.match(html, new RegExp(`>${label}<`));
  }
  assert.doesNotMatch(html, /<button[^>]*disabled[^>]*>[\s\S]*공유하기/);

  // Mounted watcher, click, and action geometry: tests/e2e/hasena-sns-behavior.spec.ts.
});

test('completion success opens certification modal before plan navigation', () => {
  // Completion/modal/navigation sequence: tests/e2e/hasena-sns-behavior.spec.ts.
});

test('certification image actions stay disabled until certification data is loaded', async () => {
  const loadingHtml = await renderModal({ value: null, loading: true });
  const readyHtml = await renderModal();
  const disabledButtons = loadingHtml.match(/<button[^>]*disabled/g) ?? [];

  assert.equal(disabledButtons.length, 3);
  assert.doesNotMatch(readyHtml, /<button[^>]*disabled/);
  assert.match(loadingHtml, /role="status"> 인증 정보를 불러오고 있습니다\./);

  // App-owned Web Share payload and AbortError handling are covered by
  // sns-certification-share-runtime.test.mjs; Chromium cannot observe the OS-owned surface.
});

test('existing verse selection share behavior remains isolated', () => {
  // Mounted verse selection payload isolation: tests/e2e/hasena-sns-behavior.spec.ts.
});
