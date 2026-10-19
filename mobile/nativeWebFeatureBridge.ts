import type { ReadingSettings } from './api/readingSettings';

export type NativeWebFeatureReply =
  | { readonly kind: 'ready'; readonly scope: string }
  | { readonly kind: 'error'; readonly scope: string; readonly requestId: string }
  | { readonly kind: 'confirming'; readonly scope: string; readonly requestId: string }
  | { readonly kind: 'cancelled'; readonly scope: string; readonly requestId: string }
  | { readonly kind: 'saving'; readonly scope: string; readonly requestId: string }
  | {
      readonly kind: 'return';
      readonly scope: string;
      readonly requestId: string;
      readonly userId: string | null;
      readonly settings: unknown;
    };

export const nativeWebFeatureOwnerId = (sessionKey: string): string | null =>
  sessionKey.startsWith('guest:') ? null : sessionKey.slice(sessionKey.lastIndexOf(':') + 1);

export const buildNativeWebFeatureBootstrap = ({
  scope, sessionKey, webAppUrl, settings,
}: {
  readonly scope: string;
  readonly sessionKey: string;
  readonly webAppUrl: string;
  readonly settings: ReadingSettings;
}): string => {
  const userId = nativeWebFeatureOwnerId(sessionKey);
  return `
    (function() {
      if (window.location.origin !== ${JSON.stringify(new URL(webAppUrl).origin)}) return;
      window.__maeilNativeFeatureContext = ${JSON.stringify({ scope, userId })};
      if (${userId === null} && sessionStorage.getItem('maeil1dok:native-feature-scope') !== ${JSON.stringify(scope)}) {
        localStorage.setItem('readingSettings', ${JSON.stringify(JSON.stringify(settings))});
        localStorage.removeItem('readingSettings:pending');
        sessionStorage.setItem('maeil1dok:native-feature-scope', ${JSON.stringify(scope)});
      }
    })();
    true;
  `;
};

export const parseNativeWebFeatureReply = (data: string): NativeWebFeatureReply | null => {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || !('type' in value) || !('scope' in value) || typeof value.scope !== 'string') return null;
  if (value.type === 'native-feature:ready') return { kind: 'ready', scope: value.scope };
  if ((value.type === 'native-feature:confirming' || value.type === 'native-feature:cancelled'
    || value.type === 'native-feature:saving')
    && 'requestId' in value && typeof value.requestId === 'string') {
    return { kind: value.type === 'native-feature:confirming' ? 'confirming'
      : value.type === 'native-feature:cancelled' ? 'cancelled' : 'saving',
      scope: value.scope, requestId: value.requestId };
  }
  if (value.type !== 'native-feature:return'
    || !('requestId' in value) || typeof value.requestId !== 'string' || !('ok' in value)) return null;
  if (value.ok === false) return { kind: 'error', scope: value.scope, requestId: value.requestId };
  if (value.ok !== true || !('userId' in value)
    || (value.userId !== null && typeof value.userId !== 'string') || !('settings' in value)) return null;
  return {
    kind: 'return', scope: value.scope, requestId: value.requestId,
    userId: value.userId, settings: value.settings,
  };
};
