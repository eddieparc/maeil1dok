import type { TokenPair } from './api/authTokens';

export interface StoredSessionRestoreDependencies {
  readonly refreshSession: () => Promise<TokenPair | null>;
  readonly initiateSessionBridge: (access: string, refresh: string) => Promise<boolean>;
  readonly navigateToPendingUrl: () => void;
  readonly abandonRestore: (reason: string) => boolean;
  readonly reportError: (error: unknown) => void;
  readonly isRestoreCurrent: () => boolean;
}

const AUTH_COOKIE_NAMES = [
  'access_token',
  'refresh_token',
  'beta_access_token',
  'beta_refresh_token',
] as const;

export const hasAuthCookies = (
  cookies: unknown,
  cookieNames: readonly string[] = AUTH_COOKIE_NAMES,
): boolean => {
  if (!cookies || typeof cookies !== 'object' || Array.isArray(cookies)) return false;

  return cookieNames.some((name) => {
    const entry = Reflect.get(cookies, name);
    if (typeof entry === 'string') return entry.length > 0;
    if (!entry || typeof entry !== 'object') return false;
    const value = Reflect.get(entry, 'value');
    return typeof value === 'string' && value.length > 0;
  });
};

export const runStoredSessionRestore = async (
  dependencies: StoredSessionRestoreDependencies,
): Promise<boolean> => {
  try {
    if (!dependencies.isRestoreCurrent()) return false;

    const tokenPair = await dependencies.refreshSession();
    if (!dependencies.isRestoreCurrent()) return false;
    if (!tokenPair) {
      return dependencies.abandonRestore('native session refresh unavailable');
    }

    const bridgeSuccess = await dependencies.initiateSessionBridge(
      tokenPair.access,
      tokenPair.refresh,
    );
    if (!dependencies.isRestoreCurrent()) return false;
    if (bridgeSuccess) dependencies.navigateToPendingUrl();
    return bridgeSuccess;
  } catch (error) {
    dependencies.reportError(error);
    return false;
  }
};
