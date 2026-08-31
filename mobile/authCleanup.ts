const AUTH_COOKIE_NAMES = ['access_token', 'refresh_token'] as const;
const SECURE_STORE_TOKEN_KEYS = [
  'maeil1dok_access_token',
  'maeil1dok_refresh_token',
] as const;
const EXPIRED_AT = '1970-01-01T00:00:00.000+00:00';

type MobilePlatform = 'ios' | 'android';

interface AuthCleanupDependencies {
  readonly platform: MobilePlatform;
  readonly apiUrl: string;
  readonly cookieDomain?: string;
  readonly clearCookieByName: (
    url: string,
    name: string,
    useWebKit: boolean,
  ) => Promise<boolean>;
  readonly setCookie: (
    url: string,
    cookie: {
      readonly name: string;
      readonly value: string;
      readonly path: '/';
      readonly expires: string;
      readonly domain?: string;
    },
  ) => Promise<boolean>;
  readonly setCookieFromResponse: (
    url: string,
    cookie: string,
  ) => Promise<boolean>;
  readonly flushCookies: () => Promise<void>;
  readonly deleteSecureValue: (key: string) => Promise<void>;
}

const throwFirstFailure = (results: readonly PromiseSettledResult<unknown>[]): void => {
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (!failed) return;
  if (failed.reason instanceof Error) throw failed.reason;
  throw new Error(String(failed.reason));
};

const clearCookies = async (dependencies: AuthCleanupDependencies): Promise<void> => {
  if (dependencies.platform === 'ios') {
    const results = await Promise.allSettled(
      AUTH_COOKIE_NAMES.flatMap((name) => [
        dependencies.clearCookieByName(dependencies.apiUrl, name, false),
        dependencies.clearCookieByName(dependencies.apiUrl, name, true),
      ]),
    );
    throwFirstFailure(results);
    return;
  }

  const results = await Promise.allSettled(
    AUTH_COOKIE_NAMES.flatMap((name) => {
      const baseCookie = {
        name,
        value: '',
        path: '/' as const,
        expires: EXPIRED_AT,
      };
      const domains = dependencies.cookieDomain
        ? [undefined, dependencies.cookieDomain]
        : [undefined];
      return domains.flatMap((domain) => {
        const domainAttribute = domain ? `; Domain=${domain}` : '';
        return [
          dependencies.setCookie(
            dependencies.apiUrl,
            domain ? { ...baseCookie, domain } : baseCookie,
          ),
          dependencies.setCookieFromResponse(
            dependencies.apiUrl,
            `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${domainAttribute}; Secure; HttpOnly`,
          ),
        ];
      });
    }),
  );
  await dependencies.flushCookies();
  throwFirstFailure(results);
};

export const clearMobileAuth = async (
  dependencies: AuthCleanupDependencies,
): Promise<void> => {
  const results = await Promise.allSettled([
    clearCookies(dependencies),
    ...SECURE_STORE_TOKEN_KEYS.map((key) => dependencies.deleteSecureValue(key)),
  ]);
  throwFirstFailure(results);
};
