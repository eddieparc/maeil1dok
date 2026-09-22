/**
 * routeMap — 웹 경로를 네이티브 라우트로 매핑하는 순수 모듈 (test target).
 *
 * 네이티브 탭(홈/성경/통독표/함께/내 정보)에 해당하는 웹 경로는 탭으로,
 * 나머지는 WebView 스택 화면으로 보낸다. 탭으로 보낼 때는 deep link의
 * 원래 URL을 params로 함께 넘겨 WebView 탭이 그 페이지를 열 수 있게 한다.
 */

export type TabRouteName = 'Home' | 'Bible' | 'Schedule' | 'Together' | 'Profile';

export type RouteTarget =
  | { readonly type: 'tab'; readonly name: TabRouteName; readonly url?: string }
  | { readonly type: 'webview'; readonly url: string }
  | { readonly type: 'login' };

const normalizePath = (pathname: string): string => {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

const TAB_ROUTES: ReadonlyArray<{ readonly prefix: string; readonly name: TabRouteName }> = [
  { prefix: '/bible', name: 'Bible' },
  { prefix: '/plan', name: 'Schedule' },
  { prefix: '/groups', name: 'Together' },
  { prefix: '/profile', name: 'Profile' },
];

const matchesPrefix = (path: string, prefix: string): boolean =>
  path === prefix || path.startsWith(`${prefix}/`);

export function mapWebPathToRoute(pathname: string | null | undefined, search = ''): RouteTarget {
  if (!pathname) {
    return { type: 'webview', url: '/' };
  }

  const path = normalizePath(pathname);
  const url = `${path}${search || ''}`;

  if (matchesPrefix(path, '/login')) {
    return { type: 'login' };
  }

  if (path === '/') {
    return { type: 'tab', name: 'Home' };
  }

  for (const route of TAB_ROUTES) {
    if (matchesPrefix(path, route.prefix)) {
      return { type: 'tab', name: route.name, url };
    }
  }

  return { type: 'webview', url };
}
