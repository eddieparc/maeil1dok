import * as Sentry from '@sentry/react-native';
import { scrubMobileSentryEvent } from './sentryScrub';

let initialized = false;

export const initMobileTelemetry = (): boolean => {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn || initialized) return false;

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment:
      process.env.EXPO_PUBLIC_ENV?.trim() || (__DEV__ ? 'development' : 'production'),
    sendDefaultPii: false,
    beforeSend: scrubMobileSentryEvent,
    beforeSendTransaction: scrubMobileSentryEvent,
    enableNative: true,
    enableAutoSessionTracking: true,
    tracesSampleRate: __DEV__ ? 0 : 0.1,
  });
  initialized = true;
  return true;
};
