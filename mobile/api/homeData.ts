/**
 * homeData — 홈 탭 데이터 정규화 (순수 모듈, test target).
 *
 * 네트워크 호출 없음. apiFetch 응답 JSON을 받아 화면이 쓰는 형태로만 변환한다.
 * 백엔드 배포본에 따라 스케줄 행의 책 키가 `book` 또는 `book_code`로 오므로
 * 둘 다 `book_code`로 정규화한다.
 */

import { rangeLabel } from './bibleBooks';

export interface PlanSubscription {
  readonly id: number;
  readonly plan_id: number;
  readonly plan_name?: string;
  readonly is_default?: boolean;
  readonly is_active?: boolean;
  readonly start_date?: string;
}

export interface TodaySchedule {
  readonly id: number;
  readonly plan?: number;
  readonly plan_name?: string;
  readonly date?: string;
  readonly book_code: string;
  readonly start_chapter: number;
  readonly end_chapter: number;
  readonly audio_link?: string | null;
  readonly guide_link?: string | null;
  readonly is_completed: boolean;
}

export interface TodaySummaryItem {
  readonly id: number;
  readonly label: string;
  readonly is_completed: boolean;
}

export interface TodaySummary {
  readonly total: number;
  readonly completed: number;
  readonly allComplete: boolean;
  readonly items: readonly TodaySummaryItem[];
}

export interface RecentRecord {
  readonly book: string;
  readonly chapter: number;
  readonly read_date: string;
}

export interface HomeStats {
  readonly bookmarks: number;
  readonly notes: number;
  readonly highlights: number;
  readonly recentRecords: readonly RecentRecord[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * 스케줄 한 행을 정규화한다. `book`/`book_code` 둘 다 받고, 필수 필드가
 * 없거나 타입이 다르면 null을 반환해 호출자가 건너뛰게 한다.
 */
export const normalizeSchedule = (raw: unknown): TodaySchedule | null => {
  if (!isRecord(raw)) return null;

  const bookCode = asString(raw.book_code) ?? asString(raw.book);
  const startChapter = asNumber(raw.start_chapter);
  const endChapter = asNumber(raw.end_chapter);
  const id = asNumber(raw.id);
  if (!bookCode || startChapter === null || id === null) return null;

  return {
    id,
    plan: asNumber(raw.plan) ?? undefined,
    plan_name: asString(raw.plan_name) ?? undefined,
    date: asString(raw.date) ?? undefined,
    book_code: bookCode,
    start_chapter: startChapter,
    end_chapter: endChapter ?? startChapter,
    audio_link: typeof raw.audio_link === 'string' ? raw.audio_link : null,
    guide_link: typeof raw.guide_link === 'string' ? raw.guide_link : null,
    is_completed: raw.is_completed === true,
  };
};

/**
 * 유효 플랜 id: is_default 구독 우선, 없으면 첫 번째 is_active 구독.
 * 둘 다 없으면 null (플랜 미구독).
 */
export const pickEffectivePlanId = (
  subscriptions: unknown,
): number | null => {
  if (!Array.isArray(subscriptions)) return null;
  const subs = subscriptions.filter(isRecord) as unknown as PlanSubscription[];

  const byDefault = subs.find((s) => s.is_default === true);
  if (byDefault && typeof byDefault.plan_id === 'number') return byDefault.plan_id;

  const firstActive = subs.find((s) => s.is_active === true);
  if (firstActive && typeof firstActive.plan_id === 'number') return firstActive.plan_id;

  return null;
};

/**
 * 오늘의 스케줄 목록을 화면용 요약으로 변환한다. malformed 행은 건너뛴다.
 * 빈 목록은 allComplete=false (표시할 일정 자체가 없으므로).
 */
export const summarizeToday = (schedules: unknown): TodaySummary => {
  const rows = Array.isArray(schedules) ? schedules : [];
  const items: TodaySummaryItem[] = [];

  for (const row of rows) {
    const schedule = normalizeSchedule(row);
    if (!schedule) continue;
    items.push({
      id: schedule.id,
      label: rangeLabel(schedule.book_code, schedule.start_chapter, schedule.end_chapter),
      is_completed: schedule.is_completed,
    });
  }

  const completed = items.filter((item) => item.is_completed).length;
  return {
    total: items.length,
    completed,
    allComplete: items.length > 0 && completed === items.length,
    items,
  };
};

/**
 * home-stats 응답을 정규화한다. 어떤 형태가 와도 throw하지 않고
 * 안전한 기본값으로 떨어진다.
 */
export const parseHomeStats = (json: unknown): HomeStats => {
  if (!isRecord(json)) {
    return { bookmarks: 0, notes: 0, highlights: 0, recentRecords: [] };
  }

  const recentRecords: RecentRecord[] = [];
  if (Array.isArray(json.recent_records)) {
    for (const raw of json.recent_records) {
      if (!isRecord(raw)) continue;
      const book = asString(raw.book);
      const chapter = asNumber(raw.chapter);
      const readDate = asString(raw.read_date);
      if (!book || chapter === null || !readDate) continue;
      recentRecords.push({ book, chapter, read_date: readDate });
    }
  }

  return {
    bookmarks: asNumber(json.bookmarks) ?? 0,
    notes: asNumber(json.notes) ?? 0,
    highlights: asNumber(json.highlights) ?? 0,
    recentRecords,
  };
};
