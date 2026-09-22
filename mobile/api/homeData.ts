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

// --- 웹 홈 패리티용 추가 파서 ---------------------------------------------

export interface HomeUser {
  readonly id: number;
  readonly nickname: string;
  readonly username: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly hasUsablePassword: boolean;
}

/** GET /api/v1/auth/user/ 응답 → 홈 헤더/인사말/배너에 쓰는 형태. */
export const parseHomeUser = (json: unknown): HomeUser | null => {
  if (!isRecord(json)) return null;
  const id = asNumber(json.id);
  if (id === null) return null;
  return {
    id,
    nickname: asString(json.nickname) ?? '',
    username: asString(json.username) ?? '',
    email: asString(json.email),
    emailVerified: json.email_verified === true,
    hasUsablePassword: json.has_usable_password_flag === true,
  };
};

export interface CalendarEntry {
  readonly date: string;
  readonly plan_id: number;
  readonly schedule_id: number;
  readonly book: string;
  readonly start_chapter: number;
  readonly end_chapter: number;
  readonly is_completed: boolean;
}

/** GET /api/v1/auth/profile/{id}/calendar/ 응답의 calendar 배열 정규화. */
export const parseCalendarEntries = (json: unknown): CalendarEntry[] => {
  if (!isRecord(json)) return [];
  const data = isRecord(json.data) ? json.data : json;
  const list = Array.isArray(data.calendar) ? data.calendar : [];
  const out: CalendarEntry[] = [];
  for (const raw of list) {
    if (!isRecord(raw)) continue;
    const date = asString(raw.date);
    const book = asString(raw.book);
    const start = asNumber(raw.start_chapter);
    if (!date || !book || start === null) continue;
    out.push({
      date,
      plan_id: asNumber(raw.plan_id) ?? 0,
      schedule_id: asNumber(raw.schedule_id) ?? 0,
      book,
      start_chapter: start,
      end_chapter: asNumber(raw.end_chapter) ?? start,
      is_completed: raw.is_completed === true,
    });
  }
  return out;
};

/** GET /api/v1/auth/profile/{id}/ 응답에서 current_streak 추출. */
export const parseStreak = (json: unknown): number | null => {
  if (!isRecord(json)) return null;
  const data = isRecord(json.data) ? json.data : json;
  const profile = isRecord(data.profile) ? data.profile : data;
  return asNumber(profile.current_streak);
};

/** GET /api/v1/todos/stats/progress/ 응답 → 0-100 정수 퍼센트. */
export const parseProgress = (json: unknown): number => {
  if (!isRecord(json)) return 0;
  const value = asNumber(json.user_progress);
  if (value === null) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

/** GET /api/v1/todos/schedules/ 응답에서 마지막 일정 날짜(YYYY-MM-DD). */
export const parseFinalScheduleDate = (json: unknown): string | null => {
  if (!Array.isArray(json)) return null;
  let latest: string | null = null;
  for (const raw of json) {
    if (!isRecord(raw)) continue;
    const date = asString(raw.date);
    if (date && (latest === null || date > latest)) latest = date;
  }
  return latest;
};

/** GET /api/v1/todos/notifications/ 응답 → 읽지 않은 알림 수. */
export const parseUnreadNotifications = (json: unknown): number => {
  if (!isRecord(json)) return 0;
  const unread = asNumber(json.unread_count);
  if (unread !== null) return unread;
  const list = Array.isArray(json.notifications)
    ? json.notifications
    : Array.isArray(json.results)
      ? json.results
      : [];
  return list.filter(
    (n) => isRecord(n) && n.is_read === false,
  ).length;
};

export type WeekDayState = 'read' | 'today' | 'upcoming' | 'missed';

export interface WeekDay {
  readonly date: string;
  readonly label: string;
  readonly number: number;
  readonly isToday: boolean;
  readonly state: WeekDayState;
}

const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

/**
 * 이번 주(월~일) 7일을 만든다. today 는 'YYYY-MM-DD'. entries 는 해당 플랜의
 * 캘린더 행 — 그 날의 행이 전부 완료면 'read'.
 */
export const buildWeek = (
  today: string,
  entries: readonly CalendarEntry[],
): WeekDay[] => {
  const monday = new Date(`${today}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const dayEntries = entries.filter((e) => e.date === key);
    const read = dayEntries.length > 0 && dayEntries.every((e) => e.is_completed);
    const isToday = key === today;
    const state: WeekDayState = read
      ? 'read'
      : isToday
        ? 'today'
        : key > today
          ? 'upcoming'
          : 'missed';
    return {
      date: key,
      label: WEEK_LABELS[index],
      number: date.getUTCDate(),
      isToday,
      state,
    };
  });
};
