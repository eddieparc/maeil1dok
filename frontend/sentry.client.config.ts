import * as Sentry from '@sentry/nuxt';
import { useRuntimeConfig } from '#imports';

const config = useRuntimeConfig();

if (config.public.sentry.dsn) {
  Sentry.init({
    dsn: config.public.sentry.dsn,
    environment: config.public.sentry.environment,
    release: config.public.sentry.release || undefined,
    tracesSampleRate: config.public.sentry.tracesSampleRate,
  });
}
