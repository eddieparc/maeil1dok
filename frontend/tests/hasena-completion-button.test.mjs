import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';
import { createSSRApp, defineComponent, h } from 'vue';

const hasenaSource = await readFile(
  new URL('../app/pages/hasena.vue', import.meta.url),
  'utf8',
);

const compileHasenaTemplate = () => {
  const { descriptor } = parse(hasenaSource, { filename: 'hasena.vue' });
  assert.ok(descriptor.template, 'Hasena page should have a template');
  const compiled = compileTemplate({
    id: 'test-hasena-completion',
    source: descriptor.template.content,
    filename: 'hasena.vue',
    compilerOptions: { mode: 'function' },
  });
  assert.deepEqual(compiled.errors, []);
  return new Function('Vue', `${compiled.code}; return render`)(Vue);
};

const renderHasenaPage = async () => {
  const passthrough = defineComponent({
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  });
  const emptyStub = defineComponent({ setup: () => () => null });
  const iconStub = defineComponent({
    setup: () => () => h('span', { 'aria-hidden': 'true' }),
  });
  const component = defineComponent({
    components: {
      PageLayout: passthrough,
      SkeletonHasenaCard: emptyStub,
      Toast: emptyStub,
      HasenaCalendarModal: emptyStub,
      CalendarDaysIcon: iconStub,
      ChevronDownIcon: iconStub,
      ChevronRightIcon: iconStub,
      FlameIcon: iconStub,
      CheckCircleIcon: iconStub,
      PlayIcon: iconStub,
      SlidersHorizontalIcon: iconStub,
      SparklesIcon: iconStub,
      TrophyIcon: iconStub,
    },
    setup() {
      return {
        auth: {
          isAuthenticated: { value: true },
          isStaff: { value: false },
        },
        bibleTitle: '사무엘상 25장',
        buttonText: '완료하기',
        error: null,
        formattedDate: '2026년 8월 26일 수요일',
        formattedSummary: '',
        generateAISummary: () => {},
        goToReadingSettings: () => {},
        handleComplete: () => {},
        hasenaStore: {
          isLoading: false,
          stats: { current_streak: 3, longest_streak: 8, total_completed: 21 },
        },
        isButtonCompleted: false,
        isCalendarOpen: false,
        isLoading: false,
        isMobile: false,
        isSummaryExpanded: false,
        latestVideoId: 'A83cdGOhMdt',
        onCalendarUpdated: () => {},
        openYouTubeApp: () => {},
        sanitizedContent: '<p>fixture</p>',
        selectHasenaDate: () => {},
        selectedDate: '2026-08-26',
        summaryContent: '',
        summaryError: 'summary unavailable',
        summaryLoading: false,
        verseContainerStyle: {},
        videoUrl: 'https://www.youtube.com/embed/A83cdGOhMdt?enablejsapi=1',
      };
    },
    render: compileHasenaTemplate(),
  });

  return renderToString(createSSRApp(component));
};

test('renders Hasena completion as a standalone inline button above the progress stats', async () => {
  const html = await renderHasenaPage();
  const actionIndex = html.indexOf('class="inline-complete-action');
  const buttonIndex = html.indexOf('class="hasena-complete-floating-btn', actionIndex);
  const streakIndex = html.indexOf('class="card streak-card', buttonIndex);

  assert.ok(actionIndex >= 0, 'Hasena page should render the inline completion action');
  assert.ok(buttonIndex > actionIndex, 'inline completion action should contain the completion button');
  assert.match(html.slice(buttonIndex, streakIndex), />완료하기</);
  assert.ok(streakIndex > buttonIndex, 'completion action should render before streak statistics');
  assert.doesNotMatch(html, /hasena-complete-floating-scrim|floating-bottom-bar/);

  // Mounted click/store behavior: tests/e2e/hasena-sns-behavior.spec.ts.
});
