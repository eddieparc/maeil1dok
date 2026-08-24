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

const YOUTUBE_DOMAINS = ['youtube.com', 'ytimg.com', 'googlevideo.com'] as const;

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

  if (url.includes('/login') && url.startsWith(options.webAppUrl)) {
    return false;
  }

  if (NATIVE_SCHEMES.some((scheme) => url.startsWith(scheme))) {
    return false;
  }

  if (OAUTH_DOMAINS.some((domain) => url.includes(domain))) {
    return true;
  }

  if (YOUTUBE_DOMAINS.some((domain) => url.includes(domain))) {
    return true;
  }

  if (!url.startsWith(options.webAppUrl) && !url.startsWith(options.apiUrl) && !url.startsWith('about:')) {
    return false;
  }

  return true;
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
  if (url && !url.startsWith(options.webAppUrl) && !url.startsWith(options.apiUrl)) {
    // 서드파티 리소스/서브프레임 실패는 앱 전체 실패가 아니다.
    return false;
  }

  return true;
}
