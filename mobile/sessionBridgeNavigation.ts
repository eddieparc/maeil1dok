export type SessionBridgeConsumeUrlOptions = {
  readonly apiUrl: string;
  readonly webAppUrl: string;
  readonly code: string;
  readonly currentUrl?: string | null;
};

const resolveSessionBridgeNextUrl = (
  currentUrl: string | null | undefined,
  webAppUrl: string,
): string => {
  const rootUrl = new URL('/', webAppUrl);
  if (!currentUrl) return rootUrl.toString();

  try {
    const candidate = new URL(currentUrl);
    const isAuthOnlyPath =
      candidate.pathname.startsWith('/login')
      || candidate.pathname.startsWith('/auth/');

    if (candidate.origin !== rootUrl.origin || isAuthOnlyPath) {
      return rootUrl.toString();
    }

    return candidate.toString();
  } catch {
    return rootUrl.toString();
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
