export type SessionBridgeConsumeUrlOptions = {
  readonly apiUrl: string;
  readonly webAppUrl: string;
  readonly code: string;
  readonly currentUrl?: string | null;
};

export const resolveSessionBridgeNextUrl = (
  currentUrl: string | null | undefined,
  webAppUrl: string,
): string => {
  const rootUrl = new URL('/', webAppUrl);
  if (!currentUrl || currentUrl.includes('\\')) return '/';

  try {
    const candidate = new URL(currentUrl);
    const isAuthOnlyPath =
      candidate.pathname.startsWith('/login')
      || candidate.pathname === '/auth'
      || candidate.pathname.startsWith('/auth/')
      || candidate.pathname.startsWith('/api/v1/auth/')
      || candidate.pathname.startsWith('/api/v1/accounts/');

    if (
      candidate.origin !== rootUrl.origin
      || candidate.pathname.startsWith('//')
      || isAuthOnlyPath
    ) {
      return '/';
    }

    return candidate.pathname + candidate.search + candidate.hash;
  } catch {
    return '/';
  }
};

export const buildSessionBridgeConsumeUrl = ({
  apiUrl,
  webAppUrl,
  code,
  currentUrl,
}: SessionBridgeConsumeUrlOptions): string =>
  `${apiUrl}/api/v1/auth/session/consume/?code=${code}&next=${encodeURIComponent(
    resolveSessionBridgeNextUrl(currentUrl, webAppUrl),
  )}`;
