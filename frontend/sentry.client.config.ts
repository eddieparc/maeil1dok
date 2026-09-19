import { useRuntimeConfig } from '#imports';
import { scrubSentryEvent } from './sentry-scrub';

const config = useRuntimeConfig();
const runtime = typeof navigator !== 'undefined' && /Maeil1Dok|wv|WebView/i.test(navigator.userAgent)
  ? 'webview'
  : 'browser';

// Sentry SDK를 초기 렌더 이후에 로드해 entry 번들에서 분리한다.
// 에러 캡처는 SDK 로드 전에 발생한 것도 큐에 쌓였다가 init 후 전송된다.
const initSentry = async () => {
  if (!config.public.sentry.dsn) return;
  const Sentry = await import('@sentry/nuxt');
  Sentry.init({
    dsn: config.public.sentry.dsn,
    environment: config.public.sentry.environment,
    release: config.public.sentry.release || undefined,
    tracesSampleRate: config.public.sentry.tracesSampleRate,
    sendDefaultPii: false,
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
    tracePropagationTargets: [
      /^https:\/\/api\.maeil1dok\.app/,
      /^http:\/\/(?:127\.0\.0\.1|localhost):8019/,
    ],
    initialScope: {
      tags: {
        runtime,
      },
    },
  });
};

if ('requestIdleCallback' in window) {
  window.requestIdleCallback(() => { void initSentry() }, { timeout: 5000 });
} else {
  setTimeout(() => { void initSentry() }, 2000);
}
