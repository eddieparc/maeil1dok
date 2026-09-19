/**
 * Bearer-token primitives for native screens (pure logic, test target).
 *
 * The storage keys are shared with the WebView session bridge and the logout
 * cleanup — all three must agree on the same SecureStore keys or the token
 * store silently splits in two. Storage is injected so node --test can
 * exercise every path without a device.
 */

export const ACCESS_TOKEN_KEY = 'maeil1dok_access_token';
export const REFRESH_TOKEN_KEY = 'maeil1dok_refresh_token';

export type TokenPair = {
  readonly access: string;
  readonly refresh: string;
};

/**
 * Only 401 means "try a refresh". 403 is a permission verdict, not an expired
 * token, and refreshing would loop without changing the answer.
 */
export const shouldRefresh = (status: number): boolean => status === 401;

export const parseTokenPair = (value: unknown): TokenPair | null => {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { access?: unknown; refresh?: unknown };
  if (typeof candidate.access !== 'string' || typeof candidate.refresh !== 'string') {
    return null;
  }
  return { access: candidate.access, refresh: candidate.refresh };
};

export const buildRefreshBody = (refreshToken: string): string =>
  JSON.stringify({ refresh: refreshToken });

export interface TokenStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export type StoredTokens = {
  readonly access: string | null;
  readonly refresh: string | null;
};

export const createTokenStore = (storage: TokenStorage) => ({
  read: async (): Promise<StoredTokens> => ({
    access: await storage.getItemAsync(ACCESS_TOKEN_KEY),
    refresh: await storage.getItemAsync(REFRESH_TOKEN_KEY),
  }),
  write: async (pair: TokenPair): Promise<void> => {
    await storage.setItemAsync(ACCESS_TOKEN_KEY, pair.access);
    await storage.setItemAsync(REFRESH_TOKEN_KEY, pair.refresh);
  },
  clear: async (): Promise<void> => {
    await storage.deleteItemAsync(ACCESS_TOKEN_KEY);
    await storage.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
});
