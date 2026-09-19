/**
 * Web path → native route mapping (pure logic, test target).
 *
 * The shell's deep links and (later) in-app navigation decisions share one
 * table: which web paths have a native home, and which still fall back to the
 * WebView. Keeping it pure lets node --test pin the contract without a device.
 */

export type TabRouteName = 'Home' | 'Bible' | 'Schedule' | 'More';

export type RouteTarget =
  | { readonly type: 'tab'; readonly name: TabRouteName }
  | { readonly type: 'webview'; readonly url: string }
  | { readonly type: 'login' };

type TabSection = {
  readonly prefix: string;
  readonly name: TabRouteName;
};

/**
 * Section prefixes match the path itself or anything below it ('/bible' and
 * '/bible/reading/...' both land on the Bible tab). A look-alike prefix like
 * '/bible-study' does NOT match — the trailing-slash requirement keeps section
 * boundaries honest.
 */
const TAB_SECTIONS: readonly TabSection[] = [
  { prefix: '/bible', name: 'Bible' },
  { prefix: '/plan', name: 'Schedule' },
  { prefix: '/account/settings', name: 'More' },
];

const matchesSection = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const mapWebPathToRoute = (
  pathname: string | null | undefined,
  search?: string | null,
): RouteTarget => {
  if (typeof pathname !== 'string' || pathname.length === 0 || !pathname.startsWith('/')) {
    return { type: 'webview', url: '/' };
  }

  if (pathname === '/') {
    return { type: 'tab', name: 'Home' };
  }

  if (matchesSection(pathname, '/login')) {
    return { type: 'login' };
  }

  for (const section of TAB_SECTIONS) {
    if (matchesSection(pathname, section.prefix)) {
      return { type: 'tab', name: section.name };
    }
  }

  const query = typeof search === 'string' ? search : '';
  return { type: 'webview', url: `${pathname}${query}` };
};
