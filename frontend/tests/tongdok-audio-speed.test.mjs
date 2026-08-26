import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';
import { createSSRApp, defineComponent, h } from 'vue';
import esbuild from 'esbuild';

const playerSource = await readFile(
  new URL('../app/components/bible/TongdokAudioPlayer.vue', import.meta.url),
  'utf8',
);
const audioRuntimeSource = await readFile(
  new URL('../app/utils/tongdokAudioRuntime.ts', import.meta.url),
  'utf8',
);
const { code } = await esbuild.transform(audioRuntimeSource, {
  format: 'esm',
  loader: 'ts',
  sourcemap: false,
});
const audioRuntime = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

const compilePlayerTemplate = () => {
  const { descriptor } = parse(playerSource, { filename: 'TongdokAudioPlayer.vue' });
  assert.ok(descriptor.template, 'TongdokAudioPlayer should have a template');
  const compiled = compileTemplate({
    id: 'test-tongdok-audio-player',
    source: descriptor.template.content,
    filename: 'TongdokAudioPlayer.vue',
    compilerOptions: { mode: 'function' },
  });
  assert.deepEqual(compiled.errors, []);
  return new Function('Vue', `${compiled.code}; return render`)(Vue);
};

const renderOpenPlayer = async () => {
  const iconStub = defineComponent({
    setup: () => () => h('span', { 'aria-hidden': 'true' }),
  });
  const component = defineComponent({
    components: {
      PauseIcon: iconStub,
      PlayIcon: iconStub,
      XIcon: iconStub,
    },
    setup() {
      return {
        PLAYBACK_RATES: audioRuntime.PLAYBACK_RATES,
        audioLink: 'https://youtu.be/video-id',
        close: () => {},
        embedUrl: 'https://www.youtube.com/embed/video-id',
        formatPlaybackRate: rate => `${rate}x`,
        formattedCurrentTime: '0:15',
        formattedDuration: '3:00',
        isOpen: true,
        isPlaying: false,
        isSpeedMenuOpen: false,
        playbackRate: 1,
        playbackRateLabel: '1x',
        progressLabel: '오디오 재생 위치 0:15 / 3:00',
        progressPercent: 8.3,
        seekFromClick: () => {},
        selectPlaybackRate: () => {},
        togglePlayback: () => {},
        toggleSpeedMenu: () => {},
        videoId: 'video-id',
      };
    },
    render: compilePlayerTemplate(),
  });

  return renderToString(createSSRApp(component));
};

test('renders a floating playback speed control for embedded tongdok audio', async () => {
  const html = await renderOpenPlayer();
  const rowStart = html.indexOf('class="youtube-progress-row"');
  const sliderIndex = html.indexOf('role="slider"', rowStart);
  const speedIndex = html.indexOf('aria-label="오디오 재생 속도 설정"', rowStart);
  const closeIndex = html.indexOf('aria-label="오디오 닫기"', rowStart);
  const rowEnd = html.indexOf('</div>', closeIndex);

  assert.ok(rowStart >= 0, 'open YouTube audio should render the progress row');
  assert.ok(sliderIndex < speedIndex, 'speed control should follow playback progress');
  assert.ok(speedIndex < closeIndex && closeIndex < rowEnd, 'speed control should sit in the row before close');
});

test('applies selected playback rates through the YouTube player API', () => {
  assert.deepEqual([...audioRuntime.PLAYBACK_RATES], [0.75, 1, 1.25, 1.5, 2]);
  for (const rate of audioRuntime.PLAYBACK_RATES) {
    assert.equal(audioRuntime.isPlaybackRate(rate), true);
  }
  for (const rate of [0.5, 1.1, 3, Number.NaN]) {
    assert.equal(audioRuntime.isPlaybackRate(rate), false);
  }

  // DROP: observing the provider side effect would require replacing YouTube's SDK
  // and asserting that replacement was called, which cannot prove real playback changed.
  // The supported rate domain remains covered above without a fake browser integration.
});
