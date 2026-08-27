/**
 * WebView 네비게이션 정책 + 에러 치명성 판별 (순수 로직, 테스트 대상)
 *
 * 배경: 하세나하시조 페이지의 YouTube 임베드는 googleads.g.doubleclick.net,
 * ep2.adtrafficquality.google 같은 서드파티 광고/측정 "서브프레임"을 띄운다.
 * 예전 정책은 이 서브프레임 문서 로드를 "외부 URL"로 보고 차단했는데,
 * iOS WKWebView는 차단된 네비게이션을 onError 로 통지한다. App.tsx 는 모든
 * onError 를 전체화면 에러로 승격시켰기 때문에 첫 진입에서 에러 화면이 떴다가
 * 뒤로 갔다 다시 들어오면(광고 프레임이 다시 뜨지 않아) 정상으로 보였다.
 *
 * 따라서 두 가지를 분리한다.
 *  1) 네비게이션 정책은 "메인 프레임"에만 적용한다. 서브프레임은 통과시킨다.
 *  2) 전체화면 에러는 "우리 앱 문서"의 실패에만 띄우고, 취소/프레임 로드 중단
 *     같은 비치명적 실패는 무시한다.
 */

export type WebViewNavigationRequest = {
  readonly url: string;
  /** iOS 에서만 제공. 값이 없으면 메인 프레임으로 간주한다. */
  readonly isTopFrame?: boolean;
};

export type WebViewErrorLike = {
  readonly url?: string;
  readonly code?: number;
  readonly description?: string;
};

export type WebViewPolicyOptions = {
  readonly webAppUrl: string;
  readonly apiUrl: string;
};

export const OAUTH_DOMAINS = [
  'kauth.kakao.com',
  'accounts.kakao.com',
  'accounts.google.com',
  'oauth.google.com',
  'appleid.apple.com',
] as const;

/**
 * Services that legitimately serve from arbitrary subdomains (`www.youtube.com`,
 * `rr1---sn-abc.googlevideo.com`). Only these get suffix matching, and only with a
 * dot boundary -- a bare `endsWith` would accept `evilyoutube.com`.
 */
const MEDIA_SUFFIX_DOMAINS = ['youtube.com', 'ytimg.com', 'googlevideo.com'] as const;

function parsedUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    // An unparseable URL cannot be proven safe, so it is not allowed.
    return null;
  }
}

function originOf(url: string): string | null {
  const parsed = parsedUrl(url);
  return parsed ? parsed.origin : null;
}

function isHttps(parsed: URL): boolean {
  return parsed.protocol === 'https:';
}

function matchesMediaDomain(host: string): boolean {
  return MEDIA_SUFFIX_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

const NATIVE_SCHEMES = ['youtube://', 'vnd.youtube://', 'intent://'] as const;

/**
 * 사용자에게 알릴 가치가 없는 실패들.
 * -999: NSURLErrorCancelled (iOS, 정책상 차단 포함)
 *  102: WebKitErrorFrameLoadInterruptedByPolicyChange
 *   -3: Android WebView ERROR_UNSUPPORTED_SCHEME (딥링크 가로채기)
 */
const NON_FATAL_ERROR_CODES = new Set<number>([-999, 102, -3]);

const NON_FATAL_DESCRIPTION_PATTERN = /cancell?ed|frame load interrupted|err_aborted|unsupported url/i;

export function isSubFrameRequest(request: WebViewNavigationRequest): boolean {
  return request.isTopFrame === false;
}

export function shouldAllowWebViewNavigation(
  request: WebViewNavigationRequest,
  options: WebViewPolicyOptions,
): boolean {
  const { url } = request;

  // 서브프레임(임베드 내부 광고/측정 프레임 등)은 정책 대상이 아니다.
  // 여기서 차단하면 WKWebView 가 onError 를 발생시킨다.
  if (isSubFrameRequest(request)) {
    return true;
  }

  // `about:` is not a network navigation; keep its existing pass-through.
  if (url.startsWith('about:')) {
    return true;
  }

  if (NATIVE_SCHEMES.some((scheme) => url.startsWith(scheme))) {
    return false;
  }

  const parsed = parsedUrl(url);
  if (!parsed || !isHttps(parsed)) {
    // Unparseable, or a scheme downgrade of an otherwise allowed host.
    return false;
  }

  const webOrigin = originOf(options.webAppUrl);
  const apiOrigin = originOf(options.apiUrl);

  // First-party origins: EXACT match. Suffix matching here would open the bridge to
  // every unconfigured subdomain (`foo.maeil1dok.app`), which is blocked today.
  const isFirstParty =
    (webOrigin !== null && parsed.origin === webOrigin) ||
    (apiOrigin !== null && parsed.origin === apiOrigin);

  if (isFirstParty && parsed.pathname.startsWith('/login')) {
    return false;
  }
  if (isFirstParty) {
    return true;
  }

  // OAuth hosts: exact host match. There is no reason to accept their subdomains.
  if (OAUTH_DOMAINS.some((domain) => parsed.hostname === domain)) {
    return true;
  }

  if (matchesMediaDomain(parsed.hostname)) {
    return true;
  }

  return false;
}

export function isFatalWebViewError(
  error: WebViewErrorLike | null | undefined,
  options: WebViewPolicyOptions,
): boolean {
  if (!error) {
    return false;
  }

  if (typeof error.code === 'number' && NON_FATAL_ERROR_CODES.has(error.code)) {
    return false;
  }

  if (error.description && NON_FATAL_DESCRIPTION_PATTERN.test(error.description)) {
    return false;
  }

  const url = typeof error.url === 'string' ? error.url : '';
  if (url) {
    // Origin equality, not prefix: a look-alike host is third-party, and escalating
    // its failure to a full-screen error would misattribute someone else's page to us.
    const failedOrigin = originOf(url);
    const webOrigin = originOf(options.webAppUrl);
    const apiOrigin = originOf(options.apiUrl);
    const isOurDocument =
      failedOrigin !== null &&
      ((webOrigin !== null && failedOrigin === webOrigin) ||
        (apiOrigin !== null && failedOrigin === apiOrigin));
    if (!isOurDocument) {
      // 서드파티 리소스/서브프레임 실패는 앱 전체 실패가 아니다.
      return false;
    }
  }

  return true;
}
