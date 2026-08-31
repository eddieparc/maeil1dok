import * as Sentry from '@sentry/nuxt';
import { useRuntimeConfig } from '#imports';
import { scrubSentryEvent } from './sentry-scrub';

const config = useRuntimeConfig();
const runtime = typeof navigator !== 'undefined' && /Maeil1Dok|wv|WebView/i.test(navigator.userAgent)
  ? 'webview'
  : 'browser';


if (config.public.sentry.dsn) {
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
}
