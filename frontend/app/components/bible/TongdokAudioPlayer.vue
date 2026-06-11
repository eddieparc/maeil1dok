<template>
  <section v-if="isOpen" class="tongdok-audio-player" aria-label="통독 오디오 재생 진행률">
    <div v-if="videoId" class="youtube-player-host" aria-hidden="true">
      <iframe
        ref="iframeRef"
        class="youtube-player-frame"
        :src="embedUrl"
        title="통독 오디오"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>

    <div v-if="videoId" class="youtube-progress-row">
      <button
        class="player-control"
        type="button"
        :aria-label="isPlaying ? '오디오 일시정지' : '오디오 재생'"
        @click="togglePlayback"
      >
        <PauseIcon v-if="isPlaying" :size="14" aria-hidden="true" />
        <PlayIcon v-else :size="14" aria-hidden="true" />
      </button>

      <button
        class="youtube-progress-track"
        type="button"
        :aria-label="progressLabel"
        :aria-valuenow="progressPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        role="slider"
        @click="seekFromClick"
      >
        <span class="youtube-progress-fill" :style="{ width: `${progressPercent}%` }"></span>
      </button>

      <span class="player-time">{{ formattedCurrentTime }} / {{ formattedDuration }}</span>

      <button class="player-close" type="button" aria-label="오디오 닫기" @click="close">
        <XIcon :size="14" aria-hidden="true" />
      </button>
    </div>

    <div v-else class="player-fallback">
      <span>앱 안에서 재생할 수 없는 링크입니다.</span>
      <button class="player-text-action" type="button" @click="$emit('open-external', audioLink)">
        외부로 열기
      </button>
      <button class="player-close" type="button" aria-label="오디오 닫기" @click="close">
        <XIcon :size="14" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { PauseIcon, PlayIcon, XIcon } from '@lucide/vue';

interface YouTubeStateMessage {
  readonly event?: string;
  readonly info?: number;
}

interface YouTubePlayerEvent {
  readonly data: number;
}

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

interface YouTubePlayerConstructor {
  new (
    element: HTMLIFrameElement,
    options: {
      events: {
        onReady: () => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
      };
    }
  ): YouTubePlayer;
}

interface YouTubeNamespace {
  Player: YouTubePlayerConstructor;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

const YOUTUBE_ENDED_STATE = 0;
const YOUTUBE_PLAYING_STATE = 1;
const YOUTUBE_PAUSED_STATE = 2;
const YOUTUBE_BUFFERING_STATE = 3;
const PROGRESS_SYNC_INTERVAL_MS = 500;

const props = defineProps<{
  audioLink: string;
  isOpen: boolean;
  scheduleRange?: string | null;
  isCompleting?: boolean;
}>();

const emit = defineEmits<{
  'update:is-open': [value: boolean];
  ended: [];
  'open-external': [url: string];
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const player = ref<YouTubePlayer | null>(null);
const currentTime = ref(0);
const duration = ref(0);
const isPlaying = ref(false);
const hasEnded = ref(false);
let progressTimer: ReturnType<typeof window.setInterval> | null = null;

const extractYouTubeVideoId = (url: string): string | null => {
  return url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1] ?? null;
};

const videoId = computed(() => extractYouTubeVideoId(props.audioLink));

const embedUrl = computed(() => {
  if (!videoId.value) return '';
  const origin = typeof window === 'undefined' ? '' : `&origin=${encodeURIComponent(window.location.origin)}`;
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId.value)}?autoplay=1&enablejsapi=1&playsinline=1&rel=0${origin}`;
});

const progressPercent = computed(() => {
  if (duration.value <= 0) return 0;
  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100));
});

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = String(wholeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
};

const formattedCurrentTime = computed(() => formatTime(currentTime.value));
const formattedDuration = computed(() => formatTime(duration.value));

const progressLabel = computed(() => {
  const range = props.scheduleRange ? `${props.scheduleRange} ` : '';
  return `${range}오디오 재생 위치 ${formattedCurrentTime.value} / ${formattedDuration.value}`;
});

const loadYouTubeApi = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
};

const syncProgress = (): void => {
  const activePlayer = player.value;
  if (!activePlayer) return;

  const nextDuration = activePlayer.getDuration();
  const nextCurrentTime = activePlayer.getCurrentTime();

  if (Number.isFinite(nextDuration) && nextDuration > 0) {
    duration.value = nextDuration;
  }

  if (Number.isFinite(nextCurrentTime) && nextCurrentTime >= 0) {
    currentTime.value = nextCurrentTime;
  }
};

const startProgressSync = (): void => {
  if (typeof window === 'undefined' || progressTimer) return;
  progressTimer = window.setInterval(syncProgress, PROGRESS_SYNC_INTERVAL_MS);
};

const stopProgressSync = (): void => {
  if (!progressTimer) return;
  window.clearInterval(progressTimer);
  progressTimer = null;
};

const handlePlayerStateChange = (event: YouTubePlayerEvent): void => {
  isPlaying.value = event.data === YOUTUBE_PLAYING_STATE || event.data === YOUTUBE_BUFFERING_STATE;

  if (event.data === YOUTUBE_PAUSED_STATE) {
    isPlaying.value = false;
  }

  syncProgress();

  if (event.data === YOUTUBE_ENDED_STATE && !hasEnded.value) {
    hasEnded.value = true;
    isPlaying.value = false;
    emit('ended');
  }
};

const destroyPlayer = (): void => {
  stopProgressSync();
  player.value?.destroy();
  player.value = null;
};

const setupPlayer = async (): Promise<void> => {
  if (!props.isOpen || !videoId.value) return;

  await nextTick();
  if (!iframeRef.value) return;

  destroyPlayer();
  hasEnded.value = false;
  currentTime.value = 0;
  duration.value = 0;

  await loadYouTubeApi();
  if (!window.YT?.Player || !iframeRef.value) return;

  player.value = new window.YT.Player(iframeRef.value, {
    events: {
      onReady: () => {
        syncProgress();
        startProgressSync();
      },
      onStateChange: handlePlayerStateChange,
    },
  });
};

const togglePlayback = (): void => {
  const activePlayer = player.value;
  if (!activePlayer) return;

  const state = activePlayer.getPlayerState();
  if (state === YOUTUBE_PLAYING_STATE || state === YOUTUBE_BUFFERING_STATE) {
    activePlayer.pauseVideo();
    isPlaying.value = false;
    return;
  }

  activePlayer.playVideo();
  isPlaying.value = true;
};

const seekFromClick = (event: MouseEvent): void => {
  const activePlayer = player.value;
  if (!activePlayer || duration.value <= 0) return;

  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;

  const bounds = target.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  const nextTime = ratio * duration.value;
  activePlayer.seekTo(nextTime, true);
  currentTime.value = nextTime;
};

const parseYouTubeMessage = (data: unknown): YouTubeStateMessage | null => {
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      return parseYouTubeMessage(parsed);
    } catch {
      return null;
    }
  }

  if (!data || typeof data !== 'object') return null;

  const rawEvent: unknown = Reflect.get(data, 'event');
  const rawInfo: unknown = Reflect.get(data, 'info');
  const event = typeof rawEvent === 'string' ? rawEvent : undefined;
  const info = typeof rawInfo === 'number' ? rawInfo : undefined;

  return { event, info };
};

const handleMessage = (event: MessageEvent): void => {
  if (!props.isOpen) return;
  if (event.origin !== 'https://www.youtube.com') return;

  const message = parseYouTubeMessage(event.data);
  if (message?.event === 'onStateChange' && message.info === YOUTUBE_ENDED_STATE && !hasEnded.value) {
    hasEnded.value = true;
    isPlaying.value = false;
    emit('ended');
  }
};

const close = (): void => {
  emit('update:is-open', false);
};

watch(
  () => [props.audioLink, props.isOpen],
  () => {
    if (props.isOpen) {
      void setupPlayer();
      return;
    }

    destroyPlayer();
  },
  { immediate: true }
);

if (typeof window !== 'undefined') {
  window.addEventListener('message', handleMessage);
}

onBeforeUnmount(() => {
  destroyPlayer();
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handleMessage);
  }
});
</script>

<style scoped>
.tongdok-audio-player {
  position: relative;
  padding: 0.5rem 1rem 0;
}

.youtube-player-host {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.youtube-player-frame {
  width: 1px;
  height: 1px;
  border: 0;
}

.youtube-progress-row,
.player-fallback {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 22px;
}

.youtube-progress-track {
  position: relative;
  display: block;
  flex: 1;
  height: 5px;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.12);
  cursor: pointer;
}

.youtube-progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0;
  border-radius: inherit;
  background: var(--color-success, #10b981);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.35);
  transition: width 0.25s linear;
}

.player-control,
.player-close,
.player-text-action {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.player-control,
.player-close {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(75, 159, 126, 0.1);
  color: var(--color-accent-primary, #4b9f7e);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
}

.player-close {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-secondary, #6b7280);
  font-size: 1rem;
}

.player-time {
  min-width: 4.6rem;
  color: var(--text-secondary, #6b7280);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  text-align: right;
  white-space: nowrap;
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
}

.player-text-action {
  flex-shrink: 0;
  padding: 0.28rem 0.45rem;
  border-radius: 7px;
  background: rgba(75, 159, 126, 0.1);
  color: var(--color-accent-primary, #4b9f7e);
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1;
}

.player-fallback {
  color: var(--text-secondary, #6b7280);
  font-size: 0.72rem;
  font-weight: 700;
}

[data-theme="dark"] .youtube-progress-track {
  background: rgba(255, 255, 255, 0.16);
}

[data-theme="dark"] .player-control {
  background: rgba(75, 159, 126, 0.18);
}

[data-theme="dark"] .player-close {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-secondary, #d1d5db);
}

[data-theme="dark"] .player-time,
[data-theme="dark"] .player-fallback {
  color: var(--color-text-secondary, #d1d5db);
}

@media (max-width: 420px) {
  .tongdok-audio-player {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .player-time {
    display: none;
  }
}
</style>
