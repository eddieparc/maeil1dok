export interface StoredSessionRefreshResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export interface StoredSessionRestoreDependencies {
  readonly apiUrl: string;
  readonly readRefreshToken: () => Promise<string | null>;
  readonly readCsrfHeaders: () => Promise<Record<string, string>>;
  readonly fetchRefresh: (
    url: string,
    init: {
      readonly method: 'POST';
      readonly headers: Record<string, string>;
      readonly body: string;
      readonly credentials: 'include';
    },
  ) => Promise<StoredSessionRefreshResponse>;
  readonly initiateSessionBridge: (access: string, refresh: string) => Promise<boolean>;
  readonly navigateToPendingUrl: () => void;
  readonly abandonRestore: (reason: string) => boolean;
  readonly reportError: (error: unknown) => void;
  readonly isRestoreCurrent: () => boolean;
}

const AUTH_COOKIE_NAMES = ['access_token', 'refresh_token'] as const;

export const hasAuthCookies = (cookies: unknown): boolean => {
  if (!cookies || typeof cookies !== 'object' || Array.isArray(cookies)) return false;

  return AUTH_COOKIE_NAMES.some((name) => {
    const entry = Reflect.get(cookies, name);
    if (typeof entry === 'string') return entry.length > 0;
    if (!entry || typeof entry !== 'object') return false;
    const value = Reflect.get(entry, 'value');
    return typeof value === 'string' && value.length > 0;
  });
};

const parseTokenPair = (value: unknown): { access: string; refresh: string } | null => {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { access?: unknown; refresh?: unknown };
  if (typeof candidate.access !== 'string' || typeof candidate.refresh !== 'string') {
    return null;
  }
  return { access: candidate.access, refresh: candidate.refresh };
};

export const runStoredSessionRestore = async (
  dependencies: StoredSessionRestoreDependencies,
): Promise<boolean> => {
  try {
    if (!dependencies.isRestoreCurrent()) return false;

    const storedRefreshToken = await dependencies.readRefreshToken();
    if (!dependencies.isRestoreCurrent() || !storedRefreshToken) return false;

    const csrfHeaders = await dependencies.readCsrfHeaders();
    if (!dependencies.isRestoreCurrent()) return false;
    const response = await dependencies.fetchRefresh(
      `${dependencies.apiUrl}/api/v1/auth/token/refresh/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders,
        },
        body: JSON.stringify({ refresh: storedRefreshToken }),
        credentials: 'include',
      },
    );

    if (!dependencies.isRestoreCurrent()) return false;
    if (!response.ok) {
      return dependencies.abandonRestore(`refresh rejected with ${response.status}`);
    }

    const tokenPair = parseTokenPair(await response.json());
    if (!dependencies.isRestoreCurrent()) return false;
    if (!tokenPair) {
      return dependencies.abandonRestore('refresh response missing tokens');
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
