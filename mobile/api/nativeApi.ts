/**
 * Authenticated API access for native screens.
 *
 * The request builders are pure; `createApiFetch` is the thin runtime that
 * attaches the Bearer token, refreshes once on 401 through the injected
 * refresher, retries once, and gives up with AuthExpiredError. Everything
 * external (fetch, token source, refresh) is injected so node --test can run
 * the whole retry contract.
 */

import { buildRefreshBody, parseTokenPair, shouldRefresh, type TokenPair } from './authTokens';

export class AuthExpiredError extends Error {
  constructor(message = '인증이 만료되었습니다. 다시 로그인해 주세요.') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

export const buildApiUrl = (base: string, path: string): string =>
  `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

export const buildAuthedHeaders = (
  token: string,
  extra?: Record<string, string>,
): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  ...extra,
});

export interface ApiFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface ApiFetchInit {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

export interface ApiFetchDependencies {
  readonly baseUrl: string;
  readonly getAccessToken: () => string | null;
  readonly getSessionVersion: () => number | null;
  readonly fetchImpl: (url: string, init: ApiFetchInit) => Promise<ApiFetchResponse>;
  /**
   * Redeem the stored refresh token for a new pair. Returns null when there is
   * recovery is unavailable. The session owner distinguishes a definitive
   * rejection from a transient failure and owns credential cleanup.
   */
  readonly refresh: () => Promise<TokenPair | null>;
}

export type ApiFetch = (path: string, init?: ApiFetchInit) => Promise<ApiFetchResponse>;

export const REFRESH_PATH = '/api/v1/auth/refresh/';

export const createApiFetch = (deps: ApiFetchDependencies): ApiFetch => {
  const send = (path: string, init: ApiFetchInit, token: string | null) =>
    deps.fetchImpl(buildApiUrl(deps.baseUrl, path), {
      ...init,
      headers: token
        ? buildAuthedHeaders(token, init.headers)
        : { ...init.headers },
    });

  return async (path, init = {}) => {
    const session = deps.getSessionVersion();
    if (session === null) throw new AuthExpiredError();
    const first = await send(path, init, deps.getAccessToken());
    if (deps.getSessionVersion() !== session) throw new AuthExpiredError();
    if (!shouldRefresh(first.status)) return first;

    const pair = await deps.refresh();
    if (deps.getSessionVersion() !== session) throw new AuthExpiredError();
    if (!pair) {
      throw new AuthExpiredError();
    }

    const retry = await send(path, init, pair.access);
    if (deps.getSessionVersion() !== session) throw new AuthExpiredError();
    if (shouldRefresh(retry.status)) {
      throw new AuthExpiredError();
    }
    return retry;
  };
};

/**
 * The one-shot refresh call shared by the session provider and apiFetch's
 * 401 recovery. Returns the rotated pair, or null when the session cannot be
 * continued. Only authentication rejections set `rejected`; rate limiting,
 * server errors and network failures preserve credentials for later recovery.
 */
export const requestTokenRefresh = async (
  baseUrl: string,
  refreshToken: string,
  fetchImpl: (url: string, init: ApiFetchInit) => Promise<ApiFetchResponse>,
  extraHeaders?: Record<string, string>,
): Promise<{ pair: TokenPair | null; rejected: boolean }> => {
  try {
    const response = await fetchImpl(buildApiUrl(baseUrl, REFRESH_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: buildRefreshBody(refreshToken),
    });
    if (!response.ok) {
      return { pair: null, rejected: [400, 401, 403].includes(response.status) };
    }
    return { pair: parseTokenPair(await response.json()), rejected: false };
  } catch {
    return { pair: null, rejected: false };
  }
};
