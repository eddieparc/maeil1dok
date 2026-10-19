/**
 * localStorage / sessionStorage 키 중앙 레지스트리.
 *
 * 앱이 영속화하는 모든 키를 여기서 열거한다 — 로그아웃/정리 경로가 무엇을
 * 지워야 하는지 한 곳에서 파악할 수 있게 하는 것이 목적이다.
 *
 * 명명 규칙: 새 키는 `maeil1dok_` 접두사를 붙인다.
 * 기존 키의 값은 이미 사용자 브라우저에 저장된 데이터를 가리키므로
 * 마이그레이션 없이 바꾸면 데이터가 고아가 된다 — 값은 그대로 유지하고,
 * 접두사 규칙은 신규 키에만 적용한다.
 */
export const STORAGE_KEYS = {
  /** 성경 리더 탭 상태 (stores/bibleTabs.ts) */
  BIBLE_READER_TABS: 'bibleReaderTabs',
  /** 페이지 네비게이션 히스토리 — sessionStorage (stores/navigation.ts) */
  NAVIGATION: 'maeil1dok_navigation',
  /** 읽기 설정 (stores/readingSettings.ts) */
  READING_SETTINGS: 'readingSettings',
  /** 레거시 뷰 옵션 키 — readingSettings로 마이그레이션 후 제거됨 */
  BIBLE_VIEW_OPTIONS: 'bibleViewOptions',
  /** 레거시 폰트 크기 키 — readingSettings로 마이그레이션 후 제거됨 */
  BIBLE_FONT_SIZE: 'bibleFontSize',
  /** 선택된 통독 플랜 ID (stores/selectedPlan.ts) */
  SELECTED_PLAN_ID: 'selectedPlanId',
  /** 마지막 읽기 위치 (composables/useReadingPosition.ts) */
  LAST_READING_POSITION: 'lastReadingPosition',
  /** 통독 모드 상태 (composables/useTongdokMode.ts) */
  TONGDOK_MODE_STATE: 'tongdokModeState',
  /** 사용자 정의 하이라이트 색상 (composables/useHighlight.ts) */
  HIGHLIGHT_CUSTOM_COLORS: 'highlightCustomColors',
  /** 캐시된 인증 사용자 (composables/useAuthService.ts) */
  AUTH: 'auth',
  /** 비자발 재인증 마커 (composables/reauthMarker.ts의 REAUTH_MARKER_KEY) */
  REAUTH_MARKER: 'auth:was-authenticated',
  /** 소셜 가입 중간 데이터 — sessionStorage (pages/auth) */
  SOCIAL_SIGNUP_DATA: 'social_signup_data',
  /** 계정 병합 중간 데이터 — sessionStorage (pages/auth) */
  MERGE_INFO: 'merge_info',
  /** 성경 홈 사용 팁 닫기 플래그 (components/bible/BibleHome.vue) */
  BIBLE_TIPS_DISMISSED: 'bible_tips_dismissed',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
