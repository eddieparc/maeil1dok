/**
 * readerAudio — 리더 오디오 선택·YouTube 파싱 (순수 모듈, test target).
 *
 * GET /api/v1/todos/detail/ 응답의 `audio_link`(플랜 일정 오디오)와
 * `fallback_audio_links`(@readingjesus 장별 성경읽기)에서 재생할 링크를 고른다.
 * 계약은 웹과 동일하다(frontend/app/utils/tongdokAudioSelection.ts):
 *
 * - `audio_link`가 있으면 항상 그것을 쓴다 — 플랜 링크가 우선.
 * - 없으면 `fallback_audio_links`에서 book+chapter가 정확히 일치하는 항목의 url.
 * - 둘 다 없으면 null — 재생 불가(버튼을 띄우지 않는다).
 *
 * YouTube URL은 watch/youtu.be/embed/v/shorts/live 형태만 받아 11자 video id를
 * 꺼낸다. 파싱할 수 없는 링크는 재생 불가로 본다.
 */

export interface ChapterFallbackAudioLink {
  readonly book: string;
  readonly chapter: number;
  readonly url: string;
}

export interface ReaderAudioSelectionInput {
  readonly audioLink?: string | null;
  readonly fallbackLinks?: readonly ChapterFallbackAudioLink[] | null;
  readonly book?: string | null;
  readonly chapter?: number | string | null;
}

export interface ReaderAudioModel {
  readonly audioLink: string | null;
  readonly fallbackLinks: readonly ChapterFallbackAudioLink[];
}

// 읽기 설정 계약과 동일한 범위 (api/readingSettings.ts AUDIO_RATE_MIN/MAX).
export const AUDIO_RATE_MIN = 0.5;
export const AUDIO_RATE_MAX = 2.0;
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

/**
 * 플랜 오디오 우선, 없으면 book+chapter 일치 폴백. 없으면 null.
 * 웹 `selectTongdokAudioLink`와 동일한 규칙이다.
 */
export const selectReaderAudioLink = ({
  audioLink,
  fallbackLinks,
  book,
  chapter,
}: ReaderAudioSelectionInput): string | null => {
  const plan = nonEmptyString(audioLink);
  if (plan) return plan;

  if (!fallbackLinks?.length || !book) return null;

  const chapterNumber = Number(chapter);
  if (!Number.isFinite(chapterNumber)) return null;

  const match = fallbackLinks.find(
    (link) => link.book === book && link.chapter === chapterNumber,
  );
  return nonEmptyString(match?.url);
};

// ---------------------------------------------------------------------------
// YouTube URL → video id
// ---------------------------------------------------------------------------

// YouTube video id는 11자 [A-Za-z0-9_-]다. 호스트는 youtube.com 계열과
// youtu.be만 허용한다 — 다른 도메인의 ?v= 파라미터를 오인하지 않기 위해
// 호스트를 먼저 검증한다.
const YOUTUBE_HOST_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com(?::\d+)?(?:[/?#]|$)/i;
const YOUTU_BE_HOST_RE = /^(?:https?:\/\/)?youtu\.be(?::\d+)?(?:[/?#]|$)/i;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const validVideoId = (candidate: string | undefined | null): string | null =>
  candidate && VIDEO_ID_RE.test(candidate) ? candidate : null;

/** 지원하는 YouTube URL에서 11자 video id를 꺼낸다. 못 읽으면 null. */
export const extractYouTubeVideoId = (url: unknown): string | null => {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed === '') return null;

  if (YOUTU_BE_HOST_RE.test(trimmed)) {
    // https://youtu.be/<id>?t=…
    const match = /youtu\.be\/([A-Za-z0-9_-]+)/i.exec(trimmed);
    return validVideoId(match?.[1]);
  }

  if (!YOUTUBE_HOST_RE.test(trimmed)) return null;

  // /embed/<id>, /v/<id>, /shorts/<id>, /live/<id>
  const pathMatch =
    /youtube\.com\/(?:embed|v|shorts|live)\/([A-Za-z0-9_-]+)/i.exec(trimmed);
  if (pathMatch) return validVideoId(pathMatch[1]);

  // /watch?v=<id> — v가 첫 파라미터가 아니어도 된다
  const queryMatch = /[?&]v=([A-Za-z0-9_-]+)/.exec(trimmed);
  return validVideoId(queryMatch?.[1]);
};

/** video id → iframe embed URL. id가 유효하지 않으면 null. */
export const buildYouTubeEmbedUrl = (videoId: string): string | null => {
  if (!VIDEO_ID_RE.test(videoId)) return null;
  return (
    `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` +
    '?enablejsapi=1&playsinline=1&rel=0&modestbranding=1'
  );
};

export interface ReaderAudioSource {
  readonly link: string;
  readonly contextKey: string;
  readonly generation: number;
}

export type ReaderAudioEvent = ReaderAudioSource & (
  | { readonly type: 'ready' | 'time'; readonly currentTime: number; readonly duration: number }
  | { readonly type: 'state'; readonly state: number }
  | { readonly type: 'ended' }
  | { readonly type: 'error'; readonly code: number }
);

/** Parse only messages from this media instance, never a previous chapter/session. */
export function parseReaderAudioEvent(data: string, source: ReaderAudioSource): ReaderAudioEvent | null {
  let value: unknown;
  try { value = JSON.parse(data); } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (!isRecord(value) || value.link !== source.link ||
    value.contextKey !== source.contextKey || value.generation !== source.generation) return null;
  switch (value.type) {
    case 'ready':
    case 'time':
      if (typeof value.currentTime !== 'number' || !Number.isFinite(value.currentTime) || value.currentTime < 0 ||
        typeof value.duration !== 'number' || !Number.isFinite(value.duration) || value.duration < 0) return null;
      return { ...source, type: value.type, currentTime: value.currentTime, duration: value.duration };
    case 'state':
      return typeof value.state === 'number' && [-1, 0, 1, 2, 3, 5].includes(value.state)
        ? { ...source, type: 'state', state: value.state } : null;
    case 'ended': return { ...source, type: 'ended' };
    case 'error':
      return typeof value.code === 'number' && Number.isFinite(value.code)
        ? { ...source, type: 'error', code: value.code } : null;
    default: return null;
  }
}

/** Media document owns the YouTube clock; RN receives snapshots, not simulated time. */
export function buildReaderAudioHtml(source: ReaderAudioSource, rate: PlaybackRate): string {
  const id = extractYouTubeVideoId(source.link);
  const binding = JSON.stringify(source).replace(/</g, '\\u003c');
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%;background:transparent}iframe{border:0;width:100%;height:100%}</style>
</head><body><iframe id="player" src="${id ? buildYouTubeEmbedUrl(id) : ''}&autoplay=1&controls=0"
allow="autoplay; encrypted-media" allowfullscreen></iframe><script>
var source = ${binding}, pendingRate = ${rate}, ytPlayer = null, timer = null, disposed = false, ready = false;
function send(event) {
  if (!disposed) window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({}, source, event)));
}
function progress(type) {
  if (disposed || !ready) return;
  send({type:type, currentTime:ytPlayer.getCurrentTime(), duration:ytPlayer.getDuration()});
}
window.__readerAudio = function(command, value) {
  if (disposed) return;
  if (command === 'rate') pendingRate = value;
  if (!ready) return;
  switch (command) {
    case 'rate': ytPlayer.setPlaybackRate(value); break;
    case 'play': ytPlayer.playVideo(); break;
    case 'pause': ytPlayer.pauseVideo(); break;
    case 'seek': ytPlayer.seekTo(value, true); progress('time'); break;
  }
};
function onYouTubeIframeAPIReady() {
  if (disposed) return;
  ytPlayer = new YT.Player('player', {events:{
    onReady:function() {
      if (disposed) return;
      ready = true;
      ytPlayer.setPlaybackRate(pendingRate);
      progress('ready');
      ytPlayer.playVideo();
      timer = setInterval(function() { progress('time'); }, 500);
    },
    onStateChange:function(event) {
      send({type:'state', state:event.data});
      progress('time');
      if (event.data === 0) send({type:'ended'});
    },
    onError:function(event) { send({type:'error', code:event.data}); }
  }});
}
window.addEventListener('pagehide', function() {
  disposed = true;
  clearInterval(timer);
  if (ytPlayer) ytPlayer.destroy();
});
var tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
tag.onerror = function() { send({type:'error', code:-1}); };
document.head.appendChild(tag);
</script></body></html>`;
}

// ---------------------------------------------------------------------------
// /api/v1/todos/detail/ 응답 파싱
// ---------------------------------------------------------------------------

const parseFallbackLink = (raw: unknown): ChapterFallbackAudioLink | null => {
  if (!isRecord(raw)) return null;
  const book = nonEmptyString(raw.book);
  const url = nonEmptyString(raw.url);
  const chapter = raw.chapter;
  if (!book || !url) return null;
  if (typeof chapter !== 'number' || !Number.isInteger(chapter) || chapter < 1) {
    return null;
  }
  return { book, chapter, url };
};

/**
 * detail 응답을 오디오 선택 모델로 정규화한다.
 * 라우터가 `{ success, data }` 봉투로 감쌀 수 있으므로 봉투가 있으면 벗긴다.
 * 깨진 입력은 "재생할 것 없음" 모델로 수렴한다.
 */
export const parseReaderAudioResponse = (body: unknown): ReaderAudioModel => {
  const empty: ReaderAudioModel = { audioLink: null, fallbackLinks: [] };
  if (!isRecord(body)) return empty;

  const data =
    isRecord(body.data) && (body.success === true || body.data.audio_link !== undefined || body.data.fallback_audio_links !== undefined)
      ? body.data
      : body;

  const audioLink = nonEmptyString(data.audio_link);
  const rawFallbacks = Array.isArray(data.fallback_audio_links)
    ? data.fallback_audio_links
    : [];
  const fallbackLinks = rawFallbacks
    .map(parseFallbackLink)
    .filter((link): link is ChapterFallbackAudioLink => link !== null);

  return { audioLink, fallbackLinks };
};
