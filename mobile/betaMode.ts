/**
 * Beta-mode stack switching (pure logic, test target).
 *
 * The web page sends `{ type: 'beta:set', enabled }` over the WebView bridge;
 * the shell persists the flag here and reloads the WebView on the other stack.
 * Beta serves frontend AND api on the same origin, so its `web` and `api`
 * entries are identical on purpose.
 */

export const BETA_MODE_STORAGE_KEY = 'maeil1dok_beta_mode';

export type BetaStack = {
  readonly web: string;
  readonly api: string;
};

export const PROD_STACK: BetaStack = {
  web: 'https://maeil1dok.app',
  api: 'https://api.maeil1dok.app',
};

export const BETA_STACK: BetaStack = {
  web: 'https://beta.maeil1dok.app',
  api: 'https://beta.maeil1dok.app',
};

/**
 * Only the literal '1' enables beta. Anything else — '0', null, undefined,
 * garbage — is prod, so a corrupted store can never strand the app on beta.
 */
export function parseBetaModeFlag(value: string | null | undefined): boolean {
  return value === '1';
}

export function resolveStack(enabled: boolean): BetaStack {
  return enabled ? BETA_STACK : PROD_STACK;
}
