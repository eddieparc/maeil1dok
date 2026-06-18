import * as Sentry from '@sentry/nuxt';

const sentryDsn = process.env.SENTRY_DSN || process.env.NUXT_PUBLIC_SENTRY_DSN || '';
const sentryTracesSampleRate = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || process.env.NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0');

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NUXT_PUBLIC_SENTRY_ENVIRONMENT,
    release: process.env.SENTRY_RELEASE || process.env.NUXT_PUBLIC_SENTRY_RELEASE || undefined,
    tracesSampleRate: Number.isFinite(sentryTracesSampleRate) && sentryTracesSampleRate >= 0 && sentryTracesSampleRate <= 1
      ? sentryTracesSampleRate
      : 0,
  });
}
