import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';
import { createSSRApp, defineComponent, h } from 'vue';

import {
  HASENA_PLAYLIST_ID,
  buildHasenaEmbedUrl,
  withJsApiEnabled,
} from '../app/utils/hasenaVideoUrl.js';

const VIDEO_ID = 'A83cdGOhMdt';
const hasenaSource = await readFile(
  new URL('../app/pages/hasena.vue', import.meta.url),
  'utf8',
);

const compileHasenaTemplate = () => {
  const { descriptor } = parse(hasenaSource, { filename: 'hasena.vue' });
  assert.ok(descriptor.template, 'Hasena page should have a template');
  const compiled = compileTemplate({
    id: 'test-hasena-video-url',
    source: descriptor.template.content,
    filename: 'hasena.vue',
    compilerOptions: { mode: 'function' },
  });
  assert.deepEqual(compiled.errors, []);
  return new Function('Vue', `${compiled.code}; return render`)(Vue);
};

const renderHasenaPage = async (videoId) => {
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
          isAuthenticated: { value: false },
          isStaff: { value: false },
        },
        bibleTitle: '하세나하시조',
        buttonText: '완료하기',
        error: 'fixture error',
        formattedDate: '2026년 8월 26일 수요일',
        formattedSummary: '',
        generateAISummary: () => {},
        goToReadingSettings: () => {},
        handleComplete: () => {},
        hasenaStore: {
          isLoading: false,
          stats: { current_streak: 0, longest_streak: 0, total_completed: 0 },
        },
        isButtonCompleted: false,
        isCalendarOpen: false,
        isLoading: false,
        isMobile: false,
        isSummaryExpanded: false,
        latestVideoId: videoId,
        onCalendarUpdated: () => {},
        openYouTubeApp: () => {},
        parsedContent: '',
        sanitizedContent: '',
        selectHasenaDate: () => {},
        selectedDate: '2026-08-26',
        summaryContent: '',
        summaryError: 'summary unavailable',
        summaryLoading: false,
        verseContainerStyle: {},
        videoUrl: withJsApiEnabled(buildHasenaEmbedUrl(videoId)),
      };
    },
    render: compileHasenaTemplate(),
  });

  return renderToString(createSSRApp(component));
};

const iframeSourceFrom = (html) => {
  const encodedSource = html.match(/<iframe[^>]*src="([^"]+)"/)?.[1];
  assert.ok(encodedSource, 'Hasena page should render a video iframe');
  return encodedSource.replaceAll('&amp;', '&');
};

test('builds a single-video embed URL whose video id stays in the path', () => {
  const url = new URL(buildHasenaEmbedUrl(VIDEO_ID));

  assert.equal(url.origin, 'https://www.youtube.com');
  assert.equal(url.pathname, `/embed/${VIDEO_ID}`);
  assert.equal(url.searchParams.get('list'), null);
});

test('keeps the video id parseable after the YouTube iframe API upgrade', () => {
  const upgraded = new URL(withJsApiEnabled(buildHasenaEmbedUrl(VIDEO_ID)));

  assert.equal(
    upgraded.pathname,
    `/embed/${VIDEO_ID}`,
    'enablejsapi must be a query parameter, never glued onto the video id path segment',
  );
  assert.equal(upgraded.searchParams.get('enablejsapi'), '1');
  assert.doesNotMatch(
    upgraded.pathname,
    /[&?=]/,
    'the embed path must never contain query syntax',
  );
});

test('keeps the playlist fallback embed valid after the API upgrade', () => {
  const upgraded = new URL(withJsApiEnabled(buildHasenaEmbedUrl('')));

  assert.equal(upgraded.pathname, '/embed/videoseries');
  assert.equal(upgraded.searchParams.get('list'), HASENA_PLAYLIST_ID);
  assert.equal(upgraded.searchParams.get('enablejsapi'), '1');
});

test('upgrading an already-enabled URL does not duplicate the parameter', () => {
  const once = withJsApiEnabled(buildHasenaEmbedUrl(VIDEO_ID));
  const twice = new URL(withJsApiEnabled(once));

  assert.deepEqual(twice.searchParams.getAll('enablejsapi'), ['1']);
});

test('hasena page renders a valid playlist fallback in its iframe', async () => {
  const iframeUrl = new URL(iframeSourceFrom(await renderHasenaPage('')));

  assert.equal(iframeUrl.pathname, '/embed/videoseries');
  assert.equal(iframeUrl.searchParams.get('list'), HASENA_PLAYLIST_ID);
  assert.equal(iframeUrl.searchParams.get('enablejsapi'), '1');
});

test('hasena page ships an iframe-API-ready initial src', async () => {
  const iframeUrl = new URL(iframeSourceFrom(await renderHasenaPage(VIDEO_ID)));

  assert.equal(iframeUrl.pathname, `/embed/${VIDEO_ID}`);
  assert.equal(iframeUrl.searchParams.get('enablejsapi'), '1');

  // Mounted iframe navigation lifecycle: tests/e2e/hasena-sns-behavior.spec.ts.
});
