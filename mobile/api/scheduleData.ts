/**
 * scheduleData — 통독표(스케줄) 탭의 순수 데이터 계층.
 *
 * 백엔드 계약 (backend/todos/views.py):
 * - GET /api/v1/todos/schedules/month/?plan_id=&month=&year=
 *   → DailyBibleScheduleSerializer 의 bare array. 로그인+구독 시
 *     is_completed 가 붙고, 아니면 필드 자체가 없다.
 * - GET /api/v1/todos/plans/user/ → { subscriptions, available_plans }
 * - POST /api/v1/todos/reading/update/ { plan_id, schedule_ids, action }
 *   action 은 'complete' | 'cancel' ('incomplete' 아님 — 서버가 400).
 *
 * 이 모듈은 fetch 를 모른다. 응답 정규화·달력 그리드·플랜 선택만 담당해
 * node --test 로 전부 검증한다.
 */

import { BIBLE_BOOKS, bookName } from './bibleBooks';

export interface ScheduleEntry {
  readonly id: number;
  readonly plan: number;
  readonly plan_name: string;
  /** 'YYYY-MM-DD' */
  readonly date: string;
  readonly book: string;
  readonly start_chapter: number;
  readonly end_chapter: number;
  readonly audio_link: string | null;
  readonly guide_link: string | null;
  readonly is_completed: boolean;
}

export interface PlanSubscription {
  readonly id: number;
  readonly plan_id: number;
  readonly plan_name: string;
  readonly is_default: boolean;
  readonly is_active: boolean;
  readonly start_date: string;
}

export interface AvailablePlan {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly is_default: boolean;
  readonly subscriber_count: number;
}

export interface UserPlansResponse {
  readonly subscriptions: PlanSubscription[];
  readonly available_plans: AvailablePlan[];
}

export interface DaySummary {
  readonly total: number;
  readonly completed: number;
}

export interface CalendarCell extends DaySummary {
  /** 'YYYY-MM-DD' — 이전/다음 달 패딩 셀도 실제 날짜를 가진다. */
  readonly date: string;
  readonly day: number;
  readonly inCurrentMonth: boolean;
}

export type MonthGrid = CalendarCell[][];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toPositiveInt = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toNonNegativeInt = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
};

const toStringOrEmpty = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const toStringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * 월간 스케줄 응답을 ScheduleEntry[] 로 정규화한다.
 * 현재 백엔드는 bare array 를 주지만, 페이지네이션/래핑이 생겨도
 * ({schedules:[...]}, {results:[...]}) 깨지지 않게 envelope-tolerant 하다.
 * id·date 가 없는 행은 렌더링할 수 없으므로 버린다.
 */
export const normalizeMonthSchedules = (json: unknown): ScheduleEntry[] => {
  let list: unknown[];
  if (Array.isArray(json)) {
    list = json;
  } else if (isRecord(json)) {
    if (Array.isArray(json.schedules)) list = json.schedules;
    else if (Array.isArray(json.results)) list = json.results;
    else return [];
  } else {
    return [];
  }

  const out: ScheduleEntry[] = [];
  for (const raw of list) {
    if (!isRecord(raw)) continue;
    const id = toPositiveInt(raw.id);
    const date = toStringOrEmpty(raw.date);
    if (id === null || date === '') continue;
    out.push({
      id,
      plan: toNonNegativeInt(raw.plan),
      plan_name: toStringOrEmpty(raw.plan_name),
      date,
      book: toStringOrEmpty(raw.book),
      start_chapter: toNonNegativeInt(raw.start_chapter),
      end_chapter: toNonNegativeInt(raw.end_chapter),
      audio_link: toStringOrNull(raw.audio_link),
      guide_link: toStringOrNull(raw.guide_link),
      is_completed: raw.is_completed === true,
    });
  }
  return out;
};

/** 날짜별 버킷. 입력 순서를 보존한다. */
export const groupByDate = (
  schedules: readonly ScheduleEntry[],
): Record<string, ScheduleEntry[]> => {
  const grouped: Record<string, ScheduleEntry[]> = {};
  for (const schedule of schedules) {
    (grouped[schedule.date] ??= []).push(schedule);
  }
  return grouped;
};

export const summarizeDay = (schedules: readonly ScheduleEntry[]): DaySummary => ({
  total: schedules.length,
  completed: schedules.filter((s) => s.is_completed).length,
});

const pad2 = (value: number): string => String(value).padStart(2, '0');

const formatDate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/**
 * 일요일 시작 주 단위 달력 그리드. month 는 1-12.
 * 첫 주는 이전 달, 마지막 주는 다음 달 날짜로 채워 항상 7의 배수 셀이 된다.
 */
export const buildMonthGrid = (
  year: number,
  month: number,
  byDate: Record<string, ScheduleEntry[]>,
): MonthGrid => {
  const first = new Date(year, month - 1, 1);
  const cursor = new Date(year, month - 1, 1 - first.getDay());
  const weeks: MonthGrid = [];
  let week: CalendarCell[] = [];

  // 그리드는 반드시 현재 달의 마지막 날을 지나 토요일에서 끝난다.
  const lastOfMonth = new Date(year, month, 0);
  while (cursor <= lastOfMonth || week.length > 0) {
    const date = formatDate(cursor);
    const summary = summarizeDay(byDate[date] ?? []);
    week.push({
      date,
      day: cursor.getDate(),
      inCurrentMonth: cursor.getMonth() === month - 1,
      ...summary,
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
      if (cursor > lastOfMonth) break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return weeks;
};

/**
 * 화면 진입 시 보여줄 구독: 활성+기본 → 활성 첫 번째 → null.
 * 비활성 구독은 진도 기록이 안 붙으므로 기본 선택에서 제외한다.
 */
export const pickDefaultPlan = (
  subscriptions: readonly PlanSubscription[],
): PlanSubscription | null =>
  subscriptions.find((s) => s.is_active && s.is_default)
  ?? subscriptions.find((s) => s.is_active)
  ?? null;

/** 달 이동. delta 는 ±1 을 상정하지만 임의 정수도 안전하다. */
export const shiftMonth = (
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } => {
  const total = (year * 12 + (month - 1)) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
};

/**
 * GET /api/v1/todos/plan/ 응답 정규화. 로그인 사용자는 구독 행(id·is_active)
 * 을 받고, 게스트는 공개 플랜 목록(id 없이 plan_id 만)을 받는다 — 둘 다 같은
 * PlanSubscription 모양으로 맞춘다. 게스트 행은 id=plan_id, is_active=true.
 * plan_id 가 없는 행은 버린다.
 */
export const normalizeSubscriptions = (json: unknown): PlanSubscription[] => {
  if (!Array.isArray(json)) return [];
  const out: PlanSubscription[] = [];
  for (const raw of json) {
    if (!isRecord(raw)) continue;
    const planId = toPositiveInt(raw.plan_id);
    if (planId === null) continue;
    const id = toPositiveInt(raw.id) ?? planId;
    out.push({
      id,
      plan_id: planId,
      plan_name: toStringOrEmpty(raw.plan_name),
      is_default: raw.is_default === true,
      is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
      start_date: toStringOrEmpty(raw.start_date),
    });
  }
  return out;
};

export interface NextPosition {
  readonly status: string;
  readonly date: string | null;
  readonly message: string | null;
}

const NEXT_POSITION_STATUSES = new Set([
  'next_incomplete',
  'all_completed',
  'today',
  'nearest',
  'no_schedule',
]);

/** GET /api/v1/todos/next-position/ 응답. 알 수 없는 status 는 null. */
export const normalizeNextPosition = (json: unknown): NextPosition | null => {
  if (!isRecord(json)) return null;
  const status = toStringOrNull(json.status);
  if (!status || !NEXT_POSITION_STATUSES.has(status)) return null;
  return {
    status,
    date: toStringOrNull(json.date),
    message: toStringOrNull(json.message),
  };
};

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 'YYYY-MM-DD' → '9/1(화)'. 파싱 불가면 원문을 그대로 돌려준다. */
export const formatScheduleDate = (date: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const [, y, m, d] = match;
  const parsed = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(parsed.getTime())) return date;
  return `${Number(m)}/${Number(d)}(${WEEKDAY_NAMES[parsed.getDay()]})`;
};

const PSALM_NAMES = new Set(['psa', '시편']);

/** '시편 7–12편' / '창세기 1–3장' / '창세기 1장'. book 은 코드든 한글이든 된다. */
export const scheduleTitle = (schedule: {
  readonly book: string;
  readonly start_chapter: number;
  readonly end_chapter: number;
}): string => {
  const name = bookName(schedule.book) || schedule.book;
  const unit = PSALM_NAMES.has(schedule.book) || name === '시편' ? '편' : '장';
  if (schedule.start_chapter === schedule.end_chapter) {
    return `${name} ${schedule.start_chapter}${unit}`;
  }
  return `${name} ${schedule.start_chapter}–${schedule.end_chapter}${unit}`;
};

export type ReadingStatus = 'completed' | 'current' | 'not_completed' | 'upcoming';

/**
 * 카드 상태: 완료가 최우선, 그 다음 오늘=current, 과거=not_completed, 미래=upcoming.
 * today 는 'YYYY-MM-DD'.
 */
export const readingStatus = (
  date: string,
  isCompleted: boolean,
  today: string,
): ReadingStatus => {
  if (isCompleted) return 'completed';
  if (date === today) return 'current';
  return date < today ? 'not_completed' : 'upcoming';
};

export interface MonthSummary {
  readonly totalDays: number;
  readonly completedDays: number;
  readonly percent: number;
}

/** 월 요약: 일정이 있는 날 중 전부 완료한 날의 수와 비율. */
export const monthSummary = (
  byDate: Record<string, ScheduleEntry[]>,
): MonthSummary => {
  const days = Object.values(byDate);
  const totalDays = days.length;
  const completedDays = days.filter((list) =>
    list.length > 0 && list.every((s) => s.is_completed),
  ).length;
  const percent = totalDays === 0 ? 0 : Math.round((completedDays / totalDays) * 100);
  return { totalDays, completedDays, percent };
};

const BOOK_ORDER = new Map(BIBLE_BOOKS.map((b, i) => [b.id, i] as const));
const BOOK_ORDER_BY_NAME = new Map(BIBLE_BOOKS.map((b, i) => [b.name, i] as const));

const bookOrder = (book: string): number =>
  BOOK_ORDER.get(book) ?? BOOK_ORDER_BY_NAME.get(book) ?? Number.MAX_SAFE_INTEGER;

/**
 * 날짜 오름차순 → 성경 권 순서 → id 내림차순. 같은 날 같은 책의 여러 일정은
 * 나중에 추가된(큰 id) 행을 먼저 보여준다 — 웹 통독표의 표시 순서와 동일.
 */
export const sortSchedules = (
  schedules: readonly ScheduleEntry[],
): ScheduleEntry[] =>
  [...schedules].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const orderDiff = bookOrder(a.book) - bookOrder(b.book);
    if (orderDiff !== 0) return orderDiff;
    return b.id - a.id;
  });
