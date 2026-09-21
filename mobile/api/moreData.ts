/**
 * moreData — 더보기 탭 데이터 정규화 (순수 모듈, test target).
 *
 * 네트워크 호출 없음. apiFetch 응답 JSON을 받아 화면이 쓰는 형태로만 변환한다.
 * 계약은 배포된 백엔드에서 확인한 형태다:
 *   GET /api/v1/auth/user/            → 사용자 객체를 래퍼 없이 직접 반환
 *   GET /api/v1/auth/linked-accounts/ → 연결된 로그인 수단 목록
 */

export interface MoreUser {
  readonly id: number;
  readonly username: string;
  readonly nickname: string;
  readonly email: string | null;
  readonly profileImage: string | null;
  readonly isStaff: boolean;
  readonly emailVerified: boolean;
  readonly hasUsablePassword: boolean;
}

export interface LinkedAccount {
  readonly provider: string;
  readonly providerDisplay: string;
  readonly email: string | null;
  readonly profileImage: string | null;
  readonly linkedAt: string | null;
  readonly canUnlink: boolean;
}

export interface LinkedAccounts {
  readonly hasPassword: boolean;
  readonly email: string | null;
  readonly primaryEmail: string | null;
  readonly authMethods: {
    readonly total: number;
    readonly password: number;
    readonly socialCount: number;
  };
  readonly providers: readonly string[];
  readonly accounts: readonly LinkedAccount[];
}

export type MoreMenuItem =
  | { readonly kind: 'link'; readonly label: string; readonly path: string }
  | { readonly kind: 'beta'; readonly label: string; readonly enabled: boolean }
  | { readonly kind: 'logout'; readonly label: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const readNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const readBoolean = (value: unknown): boolean => value === true;

const readNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/**
 * /auth/user/ 는 사용자 객체를 래퍼 없이 직접 반환한다. id·username이 없으면
 * 사용자가 아니므로 null — 화면은 이를 에러 상태로 처리한다.
 */
export function parseUser(json: unknown): MoreUser | null {
  if (!isRecord(json)) return null;
  if (typeof json.id !== 'number' || !Number.isFinite(json.id)) return null;
  const username = readString(json.username);
  if (!username) return null;

  return {
    id: json.id,
    username,
    nickname: readString(json.nickname) ?? username,
    email: readNullableString(json.email),
    profileImage: readNullableString(json.profile_image),
    isStaff: readBoolean(json.is_staff),
    emailVerified: readBoolean(json.email_verified),
    hasUsablePassword: readBoolean(json.has_usable_password_flag),
  };
}

/**
 * 연결 수단 목록. 최상위가 객체가 아니면 null, 그 안의 행이 깨져 있으면 그 행만
 * 버린다 — 한 provider의 이상한 행 때문에 전체 카드를 에러로 만들지 않는다.
 */
export function parseLinkedAccounts(json: unknown): LinkedAccounts | null {
  if (!isRecord(json)) return null;

  const rawMethods = isRecord(json.auth_methods) ? json.auth_methods : {};
  const rawProviders = Array.isArray(rawMethods.providers) ? rawMethods.providers : [];
  const rawAccounts = Array.isArray(json.linked_accounts) ? json.linked_accounts : [];

  const accounts: LinkedAccount[] = [];
  for (const row of rawAccounts) {
    if (!isRecord(row)) continue;
    const provider = readString(row.provider);
    if (!provider) continue;
    accounts.push({
      provider,
      providerDisplay: readString(row.provider_display) ?? provider,
      email: readNullableString(row.email),
      profileImage: readNullableString(row.profile_image),
      linkedAt: readNullableString(row.linked_at),
      canUnlink: readBoolean(row.can_unlink),
    });
  }

  return {
    hasPassword: readBoolean(json.has_password),
    email: readNullableString(json.email),
    primaryEmail: readNullableString(json.primary_email),
    authMethods: {
      total: readNumber(rawMethods.total),
      password: readNumber(rawMethods.password),
      socialCount: readNumber(rawMethods.social_count),
    },
    providers: rawProviders.filter((p): p is string => typeof p === 'string'),
    accounts,
  };
}

const WEB_LINKS: ReadonlyArray<{ readonly label: string; readonly path: string }> = [
  { label: '알림', path: '/notifications' },
  { label: '그룹', path: '/groups' },
  { label: '노트', path: '/bible/notes' },
  { label: '북마크', path: '/bible/bookmarks' },
  { label: '하이라이트', path: '/bible/highlights' },
  { label: '읽기 기록', path: '/bible/history' },
  { label: '계정 설정', path: '/account/settings' },
  { label: '알림 설정', path: '/notifications/settings' },
  { label: '공지', path: '/notice' },
  { label: '문의', path: '/support' },
];

/**
 * 더보기 메뉴 모델. 웹 링크 → 베타 모드 → 로그아웃 순서.
 *
 * 베타 행은 모든 사용자에게 보인다 — 웹의 계정 설정 페이지도 같은 토글을
 * 전원에게 노출하므로 네이티브도 같은 계약을 따른다.
 */
export function buildMenuItems(options: {
  readonly betaEnabled: boolean;
}): readonly MoreMenuItem[] {
  const items: MoreMenuItem[] = WEB_LINKS.map((link) => ({
    kind: 'link',
    label: link.label,
    path: link.path,
  }));

  items.push({ kind: 'beta', label: '베타 모드', enabled: options.betaEnabled });
  items.push({ kind: 'logout', label: '로그아웃' });
  return items;
}
