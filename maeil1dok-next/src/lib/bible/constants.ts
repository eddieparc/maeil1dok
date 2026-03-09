/**
 * Bible Constants
 *
 * 성경 관련 모든 상수 정의를 중앙 집중화
 */

// ============================================
// Bible Book Data
// ============================================

export interface BibleBook {
  id: string;
  name: string;
  abbreviation: string;
  chapters: number;
}

/**
 * 구약 성경 (39권)
 * ID 체계: books.ts 기준 (sa1, ki1, ch1, co1, th1, ti1, pe1, jo1, eze, joe)
 */
export const OLD_TESTAMENT: BibleBook[] = [
  { id: 'gen', name: '창세기', abbreviation: '창', chapters: 50 },
  { id: 'exo', name: '출애굽기', abbreviation: '출', chapters: 40 },
  { id: 'lev', name: '레위기', abbreviation: '레', chapters: 27 },
  { id: 'num', name: '민수기', abbreviation: '민', chapters: 36 },
  { id: 'deu', name: '신명기', abbreviation: '신', chapters: 34 },
  { id: 'jos', name: '여호수아', abbreviation: '수', chapters: 24 },
  { id: 'jdg', name: '사사기', abbreviation: '삿', chapters: 21 },
  { id: 'rut', name: '룻기', abbreviation: '룻', chapters: 4 },
  { id: 'sa1', name: '사무엘상', abbreviation: '삼상', chapters: 31 },
  { id: 'sa2', name: '사무엘하', abbreviation: '삼하', chapters: 24 },
  { id: 'ki1', name: '열왕기상', abbreviation: '왕상', chapters: 22 },
  { id: 'ki2', name: '열왕기하', abbreviation: '왕하', chapters: 25 },
  { id: 'ch1', name: '역대상', abbreviation: '대상', chapters: 29 },
  { id: 'ch2', name: '역대하', abbreviation: '대하', chapters: 36 },
  { id: 'ezr', name: '에스라', abbreviation: '스', chapters: 10 },
  { id: 'neh', name: '느헤미야', abbreviation: '느', chapters: 13 },
  { id: 'est', name: '에스더', abbreviation: '에', chapters: 10 },
  { id: 'job', name: '욥기', abbreviation: '욥', chapters: 42 },
  { id: 'psa', name: '시편', abbreviation: '시', chapters: 150 },
  { id: 'pro', name: '잠언', abbreviation: '잠', chapters: 31 },
  { id: 'ecc', name: '전도서', abbreviation: '전', chapters: 12 },
  { id: 'sng', name: '아가', abbreviation: '아', chapters: 8 },
  { id: 'isa', name: '이사야', abbreviation: '사', chapters: 66 },
  { id: 'jer', name: '예레미야', abbreviation: '렘', chapters: 52 },
  { id: 'lam', name: '예레미야애가', abbreviation: '애', chapters: 5 },
  { id: 'eze', name: '에스겔', abbreviation: '겔', chapters: 48 },
  { id: 'dan', name: '다니엘', abbreviation: '단', chapters: 12 },
  { id: 'hos', name: '호세아', abbreviation: '호', chapters: 14 },
  { id: 'joe', name: '요엘', abbreviation: '욜', chapters: 3 },
  { id: 'amo', name: '아모스', abbreviation: '암', chapters: 9 },
  { id: 'oba', name: '오바댜', abbreviation: '옵', chapters: 1 },
  { id: 'jon', name: '요나', abbreviation: '욘', chapters: 4 },
  { id: 'mic', name: '미가', abbreviation: '미', chapters: 7 },
  { id: 'nah', name: '나훔', abbreviation: '나', chapters: 3 },
  { id: 'hab', name: '하박국', abbreviation: '합', chapters: 3 },
  { id: 'zep', name: '스바냐', abbreviation: '습', chapters: 3 },
  { id: 'hag', name: '학개', abbreviation: '학', chapters: 2 },
  { id: 'zec', name: '스가랴', abbreviation: '슥', chapters: 14 },
  { id: 'mal', name: '말라기', abbreviation: '말', chapters: 4 },
];

/**
 * 신약 성경 (27권)
 * ID 체계: books.ts 기준 (co1, co2, th1, th2, ti1, ti2, pe1, pe2, jo1, jo2, jo3, jam)
 */
export const NEW_TESTAMENT: BibleBook[] = [
  { id: 'mat', name: '마태복음', abbreviation: '마', chapters: 28 },
  { id: 'mrk', name: '마가복음', abbreviation: '막', chapters: 16 },
  { id: 'luk', name: '누가복음', abbreviation: '눅', chapters: 24 },
  { id: 'jhn', name: '요한복음', abbreviation: '요', chapters: 21 },
  { id: 'act', name: '사도행전', abbreviation: '행', chapters: 28 },
  { id: 'rom', name: '로마서', abbreviation: '롬', chapters: 16 },
  { id: 'co1', name: '고린도전서', abbreviation: '고전', chapters: 16 },
  { id: 'co2', name: '고린도후서', abbreviation: '고후', chapters: 13 },
  { id: 'gal', name: '갈라디아서', abbreviation: '갈', chapters: 6 },
  { id: 'eph', name: '에베소서', abbreviation: '엡', chapters: 6 },
  { id: 'php', name: '빌립보서', abbreviation: '빌', chapters: 4 },
  { id: 'col', name: '골로새서', abbreviation: '골', chapters: 4 },
  { id: 'th1', name: '데살로니가전서', abbreviation: '살전', chapters: 5 },
  { id: 'th2', name: '데살로니가후서', abbreviation: '살후', chapters: 3 },
  { id: 'ti1', name: '디모데전서', abbreviation: '딤전', chapters: 6 },
  { id: 'ti2', name: '디모데후서', abbreviation: '딤후', chapters: 4 },
  { id: 'tit', name: '디도서', abbreviation: '딛', chapters: 3 },
  { id: 'phm', name: '빌레몬서', abbreviation: '몬', chapters: 1 },
  { id: 'heb', name: '히브리서', abbreviation: '히', chapters: 13 },
  { id: 'jam', name: '야고보서', abbreviation: '약', chapters: 5 },
  { id: 'pe1', name: '베드로전서', abbreviation: '벧전', chapters: 5 },
  { id: 'pe2', name: '베드로후서', abbreviation: '벧후', chapters: 3 },
  { id: 'jo1', name: '요한1서', abbreviation: '요일', chapters: 5 },
  { id: 'jo2', name: '요한2서', abbreviation: '요이', chapters: 1 },
  { id: 'jo3', name: '요한3서', abbreviation: '요삼', chapters: 1 },
  { id: 'jud', name: '유다서', abbreviation: '유', chapters: 1 },
  { id: 'rev', name: '요한계시록', abbreviation: '계', chapters: 22 },
];

/**
 * 전체 성경 (66권)
 */
export const ALL_BOOKS: BibleBook[] = [...OLD_TESTAMENT, ...NEW_TESTAMENT];

// ============================================
// Lookup Maps (성능 최적화를 위한 Map)
// ============================================

/**
 * 성경 이름 → 인덱스 맵 (정렬용)
 */
export const BOOK_ORDER_MAP: Map<string, number> = new Map(
  ALL_BOOKS.map((book, index) => [book.name, index])
);

/**
 * 성경 이름 → 코드 맵
 */
export const BOOK_CODE_MAP: Map<string, string> = new Map(
  ALL_BOOKS.map(book => [book.name, book.id])
);

/**
 * 성경 코드 → 이름 맵
 */
export const CODE_TO_NAME_MAP: Map<string, string> = new Map(
  ALL_BOOKS.map(book => [book.id, book.name])
);

/**
 * 성경 이름 → 축약어 맵
 */
export const BOOK_ABBREVIATION_MAP: Map<string, string> = new Map(
  ALL_BOOKS.map(book => [book.name, book.abbreviation])
);

// ============================================
// Utility Functions
// ============================================

/**
 * 성경 이름으로 정렬 순서 인덱스 반환
 * @param bookName 한글 성경 이름
 * @returns 정렬 순서 (0-65), 찾지 못하면 999
 */
export function getBookOrder(bookName: string): number {
  return BOOK_ORDER_MAP.get(bookName) ?? 999;
}

/**
 * 성경 이름을 코드로 변환
 * @param bookName 한글 성경 이름
 * @returns 성경 코드 (예: 'gen') 또는 null
 */
export function getBookCode(bookName: string): string | null {
  return BOOK_CODE_MAP.get(bookName) ?? null;
}

/**
 * 성경 코드를 이름으로 변환
 * @param bookCode 성경 코드
 * @returns 한글 성경 이름 또는 null
 */
export function getBookName(bookCode: string): string | null {
  return CODE_TO_NAME_MAP.get(bookCode) ?? null;
}

/**
 * 성경 이름을 축약어로 변환
 * @param bookName 한글 성경 이름
 * @returns 축약어 (예: '창') 또는 이름의 첫 2글자
 */
export function getBookAbbreviation(bookName: string): string {
  return BOOK_ABBREVIATION_MAP.get(bookName) ?? (bookName ? bookName.slice(0, 2) : '');
}

/**
 * 성경 코드로 책 정보 조회
 * @param bookCode 성경 코드
 * @returns BibleBook 객체 또는 undefined
 */
export function getBookByCode(bookCode: string): BibleBook | undefined {
  return ALL_BOOKS.find(book => book.id === bookCode);
}

/**
 * 성경 이름으로 책 정보 조회
 * @param bookName 한글 성경 이름
 * @returns BibleBook 객체 또는 undefined
 */
export function getBookByName(bookName: string): BibleBook | undefined {
  return ALL_BOOKS.find(book => book.name === bookName);
}

// ============================================
// Display Constants
// ============================================

/**
 * 요일 이름 (일-토)
 */
export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * 월 배열 (1-12)
 */
export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// ============================================
// UI Constants
// ============================================

/**
 * 액션 메뉴 관련 상수
 */
export const ACTION_MENU = {
  WIDTH: 240,
  HALF_WIDTH: 120,
  TOP_OFFSET: 60,
  EDGE_MARGIN: 10,
} as const;

/**
 * 복사 메뉴 관련 상수
 */
export const COPY_MENU = {
  BOTTOM_POSITION: 120,
} as const;

// ============================================
// Timing Constants
// ============================================

/**
 * 디바운스/타임아웃 관련 상수 (ms)
 */
export const TIMING = {
  AUTO_SAVE_DEBOUNCE: 3000,
  SCROLL_SAVE_DEBOUNCE: 1500,
  SCROLL_THROTTLE: 100,
  VERSE_RESELECT_DELAY: 250,
} as const;

// ============================================
// Text Preview Constants
// ============================================

/**
 * 텍스트 미리보기 관련 상수
 */
export const TEXT_PREVIEW = {
  NOTE_PREVIEW_LENGTH: 120,
  HIGHLIGHT_MEMO_LENGTH: 100,
  BOOKMARK_MEMO_LENGTH: 80,
} as const;

// ============================================
// UI Size Constants
// ============================================

/**
 * 토글 스위치 크기 (px)
 */
export const TOGGLE_SIZE = {
  WIDTH: 48,
  HEIGHT: 28,
  THUMB: 22,
} as const;

/**
 * 최소 터치 타겟 크기 (Apple HIG 기준)
 */
export const TOUCH_TARGET = {
  MIN_WIDTH: 44,
  MIN_HEIGHT: 44,
} as const;
