/**
 * Reader tongdok state.
 *
 * The backend stores completion per schedule row. Chapter marks in this module
 * belong only to the active reader session and are used to decide when a real
 * schedule row is eligible for that existing write API.
 */
import { computed, ref, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { BIBLE_BOOKS, useBibleData } from './useBibleData';
import { useApi } from './useApi';
import type { paths } from '~/types/generated/api-schema';
import {
  selectTongdokAudioLink,
  type ChapterFallbackAudioLink,
} from '~/utils/tongdokAudioSelection';

export interface PlanDetail {
  book: string;
  book_kor?: string;
  start_chapter: number;
  end_chapter: number;
  is_complete: boolean;
  schedule_id?: number;
  date?: string;
}

export interface ReadingDetailData {
  book?: string;
  chapter?: number | string;
  plan_id?: number;
  plan_name?: string;
  plan_detail?: PlanDetail[];
  audio_link?: string | null;
  fallback_audio_links?: ChapterFallbackAudioLink[] | null;
  guide_link?: string | null;
  plan_date?: string;
  schedule_date?: string;
  message?: string;
  is_complete?: boolean;
}

export interface ReadingDetailResponse {
  data?: ReadingDetailData;
}

export interface TongdokContextIdentity {
  planId: number;
  scheduleId: number;
  scheduleDate: string | null;
}

export interface TongdokProgress {
  /** One-based position in the current range, or zero when outside it. */
  current: number;
  total: number;
  /** Chapters completed by server rows or marked in this active session. */
  done: number;
  isCurrentInRange: boolean;
  isComplete: boolean;
}

export type CompleteCurrentChapterStatus =
  | 'completed'
  | 'progressed'
  | 'already-complete'
  | 'cancelled'
  | 'not-complete'
  | 'out-of-range'
  | 'invalid-context'
  | 'busy'
  | 'failed'
  | 'stale-context';

export interface CompleteCurrentChapterResult {
  ok: boolean;
  status: CompleteCurrentChapterStatus;
  planId: number | null;
  selectedScheduleId: number | null;
  scheduleDate: string | null;
  markedChapter: { book: string; chapter: number } | null;
  /** Every row known complete after this operation. */
  completedScheduleIds: number[];
  /** Rows acknowledged by /reading/update/ during this operation. */
  persistedScheduleIds: number[];
  scheduleCompleted: boolean;
  progress: TongdokProgress | null;
}

type BibleBook = NonNullable<
  paths['/api/v1/todos/detail/']['get']['parameters']['query']
>['book'];

const BIBLE_BOOK_CODES = new Set<string>(
  [...BIBLE_BOOKS.old, ...BIBLE_BOOKS.new].map(book => book.id)
);
const TONGDOK_STATE_KEY = 'tongdokModeState';

interface TongdokStateStorage {
  enabled: boolean;
  scheduleId: number | null;
  planId: number | null;
  scheduleDate?: string | null;
  updatedAt: string;
}

interface LoadedDetailIdentity {
  planId: number | null;
  scheduleId: number | null;
  scheduleDate: string | null;
  book: string;
  chapter: number;
}

interface AuthoritativeDetail {
  identity: TongdokContextIdentity;
  data: ReadingDetailData;
  rows: Array<PlanDetail & { schedule_id: number; date: string }>;
}

const toBibleBook = (value: string): BibleBook | undefined =>
  BIBLE_BOOK_CODES.has(value) ? (value as BibleBook) : undefined;
const positiveId = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};
const positiveChapter = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};
const chapterKey = (book: string, chapter: number): string => `${book}:${chapter}`;

const loadTongdokState = (): TongdokStateStorage | null => {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(TONGDOK_STATE_KEY) || 'null') as TongdokStateStorage | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveTongdokState = (state: TongdokStateStorage): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TONGDOK_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save tongdok state:', error);
  }
};

const clearTongdokState = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TONGDOK_STATE_KEY);
  } catch (error) {
    console.warn('Failed to clear tongdok state:', error);
  }
};

// Shared state: the reader has one active tongdok session per app instance.
const tongdokMode = ref(false);
const tongdokScheduleId: Ref<number | null> = ref(null);
const tongdokPlanId: Ref<number | null> = ref(null);
const tongdokScheduleDate: Ref<string | null> = ref(null);
const readingDetailResponse: Ref<ReadingDetailResponse | null> = ref(null);
const isCompleting = ref(false);
const lastCompleteCurrentResult: Ref<CompleteCurrentChapterResult | null> = ref(null);
const sessionChapterMarks = new Set<string>();
const sessionPersistedScheduleIds = new Set<number>();
// Rows cancelled in this active session. Cached or stale fetched rows that
// still claim completion must not resurrect them.
const sessionCancelledScheduleIds = new Set<number>();
const detailCache = new Map<string, ReadingDetailResponse>();
let loadedDetailIdentity: LoadedDetailIdentity | null = null;
let activeScheduleRange: Pick<ReadingDetailData, 'plan_detail' | 'plan_date' | 'schedule_date'> | null = null;
let detailRequestVersion = 0;

const resetActiveSession = (clearDetail = true): void => {
  sessionChapterMarks.clear();
  sessionPersistedScheduleIds.clear();
  sessionCancelledScheduleIds.clear();
  lastCompleteCurrentResult.value = null;
  loadedDetailIdentity = null;
  activeScheduleRange = null;
  detailRequestVersion += 1;
  if (clearDetail) readingDetailResponse.value = null;
};

const currentContextKey = (
  planId: number | null,
  book: string,
  chapter: number,
): string => {
  const scheduleId = tongdokMode.value && tongdokPlanId.value === planId
    ? tongdokScheduleId.value
    : null;
  const scheduleDate = scheduleId === null ? null : tongdokScheduleDate.value;
  return [planId ?? 'plain', scheduleId ?? 'none', scheduleDate ?? 'unknown', book, chapter].join('|');
};

const sameIdentity = (left: LoadedDetailIdentity, right: LoadedDetailIdentity): boolean =>
  left.planId === right.planId &&
  left.scheduleId === right.scheduleId &&
  left.scheduleDate === right.scheduleDate &&
  left.book === right.book &&
  left.chapter === right.chapter;

const currentLoadedIdentity = (book: string, chapter: number): LoadedDetailIdentity => ({
  planId: tongdokPlanId.value,
  scheduleId: tongdokScheduleId.value,
  scheduleDate: tongdokScheduleDate.value,
  book,
  chapter,
});

export const useTongdokMode = () => {
  const route = useRoute();
  const router = useRouter();
  const api = useApi();
  const { bookNames } = useBibleData();

  const activeTongdokContext = computed<TongdokContextIdentity | null>(() => {
    const planId = positiveId(tongdokPlanId.value);
    const scheduleId = positiveId(tongdokScheduleId.value);
    if (!tongdokMode.value || planId === null || scheduleId === null) return null;
    return { planId, scheduleId, scheduleDate: tongdokScheduleDate.value };
  });

  const persistActiveContext = (): void => {
    saveTongdokState({
      enabled: true,
      scheduleId: tongdokScheduleId.value,
      planId: tongdokPlanId.value,
      scheduleDate: tongdokScheduleDate.value,
      updatedAt: new Date().toISOString(),
    });
  };

  const setModeIdentity = (
    enabled: boolean,
    scheduleId: number | null,
    planId: number | null,
    scheduleDate: string | null,
  ): void => {
    const changed = tongdokMode.value !== enabled ||
      tongdokScheduleId.value !== scheduleId ||
      tongdokPlanId.value !== planId ||
      tongdokScheduleDate.value !== scheduleDate;
    tongdokMode.value = enabled;
    tongdokScheduleId.value = scheduleId;
    tongdokPlanId.value = planId;
    tongdokScheduleDate.value = scheduleDate;
    if (changed) resetActiveSession();
  };

  /** Bare /bible is the hub. A stored session is restored only for explicit reader intent. */
  const initTongdokMode = (): void => {
    const query = route.query;
    const hasExplicitReaderIntent = Boolean(
      query.book || query.chapter || query.verse || query.search ||
      query.tongdok || query.plan || query.schedule || query.from
    );

    if (route.path === '/bible' && !hasExplicitReaderIntent) {
      setModeIdentity(false, null, null, null);
      return;
    }

    if (query.tongdok === 'true' || query.plan) {
      setModeIdentity(
        true,
        positiveId(query.schedule),
        positiveId(query.plan),
        typeof query.date === 'string' ? query.date : null,
      );
      persistActiveContext();
      return;
    }

    const saved = loadTongdokState();
    if (saved?.enabled) {
      setModeIdentity(
        true,
        positiveId(saved.scheduleId),
        positiveId(saved.planId),
        typeof saved.scheduleDate === 'string' ? saved.scheduleDate : null,
      );
      return;
    }

    setModeIdentity(false, null, null, null);
  };

  const getAuthoritativeDetail = (
    data = readingDetailResponse.value?.data,
    detailIdentity = loadedDetailIdentity,
  ): AuthoritativeDetail | null => {
    const identity = activeTongdokContext.value;
    if (!identity || !data || !detailIdentity) return null;

    const loadedChapter = positiveChapter(data.chapter);
    const expectedLoaded = currentLoadedIdentity(data.book || '', loadedChapter || 0);
    if (!sameIdentity(detailIdentity, expectedLoaded)) return null;
    if (positiveId(data.plan_id) !== identity.planId || !data.book || loadedChapter === null) return null;

    const responseDate = data.plan_date || data.schedule_date || null;
    // scheduleDate is optional in the identity: the ?date= query param is not
    // always present (e.g. deep links like ?tongdok=true&plan=4&book=psa&chapter=7).
    // When it is absent, accept whatever date the backend resolved for today.
    if (identity.scheduleDate && responseDate !== identity.scheduleDate) return null;

    const rawRows = data.plan_detail;
    if (!rawRows?.length) return null;
    const effectiveDate = identity.scheduleDate || responseDate;
    const rows: AuthoritativeDetail['rows'] = [];
    for (const row of rawRows) {
      const scheduleId = positiveId(row.schedule_id);
      if (scheduleId === null || (effectiveDate && row.date !== effectiveDate)) return null;
      rows.push({ ...row, schedule_id: scheduleId, date: row.date ?? effectiveDate ?? '' });
    }
    // scheduleId is optional in the identity: the ?schedule= query param is not
    // always present (e.g. deep links like ?tongdok=true&plan=4&book=psa&chapter=7).
    // When it is absent, accept whatever schedule the backend resolved for today.
    if (identity.scheduleId !== null && !rows.some(row => row.schedule_id === identity.scheduleId)) return null;
    return { identity, data, rows };
  };

  const rowContains = (row: PlanDetail, book: string, chapter: number): boolean =>
    row.book === book && chapter >= row.start_chapter && chapter <= row.end_chapter;
  const rowCompleted = (row: PlanDetail & { schedule_id: number }): boolean =>
    !sessionCancelledScheduleIds.has(row.schedule_id) &&
    (row.is_complete === true || sessionPersistedScheduleIds.has(row.schedule_id));
  const rowChaptersMarked = (row: PlanDetail): boolean => {
    for (let chapter = row.start_chapter; chapter <= row.end_chapter; chapter += 1) {
      if (!sessionChapterMarks.has(chapterKey(row.book, chapter))) return false;
    }
    return true;
  };

  const calculateProgress = (
    rows: Array<PlanDetail & { schedule_id?: number }>,
    currentBook: string,
    currentChapter: number,
  ): TongdokProgress => {
    let total = 0;
    let done = 0;
    let current = 0;
    let ordinal = 0;

    for (const row of rows) {
      const rowScheduleId = positiveId(row.schedule_id);
      const serverOrPersistedComplete = (rowScheduleId === null || !sessionCancelledScheduleIds.has(rowScheduleId)) &&
        (row.is_complete === true ||
          (rowScheduleId !== null && sessionPersistedScheduleIds.has(rowScheduleId)));
      for (let chapter = row.start_chapter; chapter <= row.end_chapter; chapter += 1) {
        ordinal += 1;
        total += 1;
        if (serverOrPersistedComplete || sessionChapterMarks.has(chapterKey(row.book, chapter))) done += 1;
        if (row.book === currentBook && chapter === currentChapter && current === 0) current = ordinal;
      }
    }

    return {
      current,
      total,
      done,
      isCurrentInRange: current > 0,
      isComplete: total > 0 && done === total,
    };
  };

  const getTongdokScheduleRange = (currentBook: string, currentChapter: number): string | null => {
    if (!tongdokMode.value || !readingDetailResponse.value?.data?.plan_detail) return null;
    const detail = readingDetailResponse.value.data.plan_detail.find(row => rowContains(row, currentBook, currentChapter));
    if (!detail) return null;
    const bookName = bookNames[detail.book] || detail.book;
    const chapters = detail.start_chapter === detail.end_chapter
      ? `${detail.start_chapter}장`
      : `${detail.start_chapter}-${detail.end_chapter}장`;
    return `${bookName} ${chapters}`;
  };

  const isLastChapterInTongdok = (currentBook: string, currentChapter: number): boolean => {
    if (!tongdokMode.value || !readingDetailResponse.value?.data?.plan_detail?.length) return false;
    const rows = readingDetailResponse.value.data.plan_detail;
    const last = rows[rows.length - 1];
    return Boolean(last && currentBook === last.book && currentChapter === last.end_chapter);
  };

  const isChapterCompleted = (book: string, chapter: number): boolean => {
    const row = readingDetailResponse.value?.data?.plan_detail?.find(detail => rowContains(detail, book, chapter));
    if (!row) return false;
    const scheduleId = positiveId(row.schedule_id);
    if (scheduleId !== null && sessionCancelledScheduleIds.has(scheduleId)) {
      return sessionChapterMarks.has(chapterKey(book, chapter));
    }
    return row.is_complete === true ||
      (scheduleId !== null && sessionPersistedScheduleIds.has(scheduleId)) ||
      sessionChapterMarks.has(chapterKey(book, chapter));
  };

  const isScheduleCompleted = (): boolean => {
    const authoritative = getAuthoritativeDetail();
    if (!authoritative) return false;
    return calculateProgress(authoritative.rows, authoritative.data.book || '', positiveChapter(authoritative.data.chapter) || 0).isComplete;
  };

  const disableTongdokMode = (): void => {
    setModeIdentity(false, null, null, null);
    clearTongdokState();
    const { tongdok: _tongdok, schedule: _schedule, plan: _plan, from: _from, date: _date, ...restQuery } = route.query;
    router.replace({ query: restQuery });
  };

  /** Existing positional arguments remain valid; date adds exact context when the caller has it. */
  const enableTongdokMode = (scheduleId?: number, planId?: number, scheduleDate?: string | null): void => {
    const nextScheduleId = scheduleId === undefined ? tongdokScheduleId.value : positiveId(scheduleId);
    const nextPlanId = planId === undefined ? tongdokPlanId.value : positiveId(planId);
    const nextDate = scheduleDate === undefined ? tongdokScheduleDate.value : scheduleDate;
    setModeIdentity(true, nextScheduleId, nextPlanId, nextDate || null);
    persistActiveContext();
  };

  /** Compatibility setter. Data supplied without a fetched identity is display-only, never completable. */
  const setReadingDetailResponse = (response: ReadingDetailResponse | null): void => {
    detailRequestVersion += 1;
    loadedDetailIdentity = null;
    activeScheduleRange = null;
    readingDetailResponse.value = response;
  };

  const applyLoadedResponse = (
    response: ReadingDetailResponse,
    requestIdentity: LoadedDetailIdentity,
  ): void => {
    const data = response.data;
    if (!data) return;

    // Deep links like ?tongdok=true&plan=4&book=psa&chapter=7 carry no
    // ?schedule= param, so the identity's scheduleId starts null and
    // activeTongdokContext would stay null forever (completion impossible).
    // Adopt the schedule_id of the plan_detail row that contains the browsed
    // chapter — that row IS the schedule the backend resolved for this chapter.
    if (requestIdentity.planId !== null && positiveId(data.plan_id) === requestIdentity.planId) {
      const browsedChapter = positiveChapter(data.chapter);
      const containing = browsedChapter === null ? undefined : data.plan_detail?.find(row =>
        row.book === (data.book || requestIdentity.book) &&
        browsedChapter >= row.start_chapter &&
        browsedChapter <= row.end_chapter);
      const adoptedId = positiveId(containing?.schedule_id);
      const browsedDate = containing?.date ?? data.plan_date ?? data.schedule_date ??
        data.plan_detail?.[0]?.date ?? null;
      // Browsing a different scheduled day adopts that day's plan context so the
      // header, progress and completion controls follow the browsed date.
      if (data.plan_detail?.length && browsedDate !== null &&
          (requestIdentity.scheduleId === null || browsedDate !== requestIdentity.scheduleDate)) {
        const nextScheduleId = adoptedId ?? positiveId(data.plan_detail[0]?.schedule_id);
        const dateChanged = browsedDate !== requestIdentity.scheduleDate;
        // requestIdentity를 먼저 갱신해야 이후 범위 검증이 새 날짜를 본다.
        if (nextScheduleId !== null) {
          tongdokScheduleId.value = nextScheduleId;
          requestIdentity.scheduleId = nextScheduleId;
        }
        tongdokScheduleDate.value = browsedDate;
        requestIdentity.scheduleDate = browsedDate;
        if (dateChanged) {
          // 날짜가 바뀌면 장 마크만 지운다. persisted/cancelled는 schedule_id
          // 키라 날짜를 넘나들어도 안전하고, 돌아온 날의 완료/취소를 보존한다.
          sessionChapterMarks.clear();
          lastCompleteCurrentResult.value = null;
          loadedDetailIdentity = null;
          activeScheduleRange = null;
        }
        persistActiveContext();
      }
      // An old positional enable call may not know the date. Adopt it only after
      // plan and selected schedule both match the fetched response.
      if (requestIdentity.scheduleId !== null && requestIdentity.scheduleDate === null) {
        const selected = data.plan_detail?.find(row => positiveId(row.schedule_id) === requestIdentity.scheduleId);
        const responseDate = data.plan_date || data.schedule_date || null;
        if (selected?.date && responseDate === selected.date) {
          tongdokScheduleDate.value = selected.date;
          requestIdentity.scheduleDate = selected.date;
          persistActiveContext();
        }
      }
    }

    data.plan_detail?.forEach(row => {
      const scheduleId = positiveId(row.schedule_id);
      if (scheduleId === null) return;
      if (sessionCancelledScheduleIds.has(scheduleId)) row.is_complete = false;
      else if (sessionPersistedScheduleIds.has(scheduleId)) row.is_complete = true;
    });
    // The API returns the browsed chapter's date group, not the active schedule.
    // Only a response validated against the active identity may replace its range.
    if (getAuthoritativeDetail(data, requestIdentity)) {
      activeScheduleRange = {
        plan_detail: data.plan_detail,
        plan_date: data.plan_date,
        schedule_date: data.schedule_date,
      };
    }
    const isActiveChapterResponse = positiveId(data.plan_id) === requestIdentity.planId &&
      sameIdentity(requestIdentity, currentLoadedIdentity(data.book || '', positiveChapter(data.chapter) || 0));
    // Preserve the page's public contract: active rows/date with browsed metadata/audio.
    readingDetailResponse.value = activeScheduleRange && isActiveChapterResponse
      ? { data: { ...data, ...activeScheduleRange, is_complete: activeScheduleRange.plan_detail?.every(row => row.is_complete) } }
      : response;
    loadedDetailIdentity = { ...requestIdentity };
  };

  const loadReadingDetail = async (
    planId: number | null,
    book: string,
    chapter: number,
  ): Promise<ReadingDetailData | null> => {
    const bibleBook = toBibleBook(book);
    if (!bibleBook || positiveChapter(chapter) === null) return null;

    const normalizedPlanId = positiveId(planId);
    const requestIdentity: LoadedDetailIdentity = {
      planId: normalizedPlanId,
      scheduleId: tongdokMode.value && tongdokPlanId.value === normalizedPlanId ? tongdokScheduleId.value : null,
      scheduleDate: tongdokMode.value && tongdokPlanId.value === normalizedPlanId ? tongdokScheduleDate.value : null,
      book,
      chapter,
    };
    const requestKey = currentContextKey(normalizedPlanId, book, chapter);
    const requestVersion = ++detailRequestVersion;
    const cached = detailCache.get(requestKey);
    if (cached) {
      applyLoadedResponse(cached, requestIdentity);
      return cached.data || null;
    }

    try {
      const response = await api.GET('/api/v1/todos/detail/', {
        params: { plan_id: normalizedPlanId ?? undefined, book: bibleBook, chapter },
      });
      const wrapped: ReadingDetailResponse = { data: response.data };
      detailCache.set(requestKey, wrapped);

      if (requestVersion !== detailRequestVersion || requestKey !== currentContextKey(normalizedPlanId, book, chapter)) {
        return response.data || null;
      }

      applyLoadedResponse(wrapped, requestIdentity);
      const adoptedKey = currentContextKey(normalizedPlanId, book, chapter);
      detailCache.set(adoptedKey, wrapped);
      return response.data || null;
    } catch (error) {
      if (requestVersion === detailRequestVersion) console.error('Failed to load reading detail:', error);
      return null;
    }
  };

  const getAudioLink = (book?: string | null, chapter?: number | string | null): string | null => {
    const detail = readingDetailResponse.value?.data;
    return selectTongdokAudioLink({
      audioLink: detail?.audio_link,
      fallbackLinks: detail?.fallback_audio_links,
      book,
      chapter,
    });
  };
  const getGuideLink = (): string | null => readingDetailResponse.value?.data?.guide_link || null;
  const getScheduleDate = (): string | null =>
    tongdokScheduleDate.value || readingDetailResponse.value?.data?.plan_date || readingDetailResponse.value?.data?.schedule_date || null;

  const getTongdokProgress = (currentBook: string, currentChapter: number): TongdokProgress | null => {
    if (!tongdokMode.value || !readingDetailResponse.value?.data?.plan_detail?.length) return null;
    return calculateProgress(readingDetailResponse.value.data.plan_detail, currentBook, currentChapter);
  };

  /** Mark every chapter in the loaded day's schedule (통독 완료 = whole range). */
  const markAllScheduleChapters = (): void => {
    const authoritative = getAuthoritativeDetail();
    if (!authoritative) return;
    for (const row of authoritative.rows) {
      for (let chapter = row.start_chapter; chapter <= row.end_chapter; chapter += 1) {
        sessionChapterMarks.add(chapterKey(row.book, chapter));
      }
    }
  };

  /** Mark only the chapter represented by the currently loaded, validated context. */
  const markCurrentChapter = (book: string, chapter: number): boolean => {
    const authoritative = getAuthoritativeDetail();
    if (!authoritative || authoritative.data.book !== book || positiveChapter(authoritative.data.chapter) !== chapter) return false;
    if (authoritative.rows.filter(row => rowContains(row, book, chapter)).length !== 1) return false;
    sessionChapterMarks.add(chapterKey(book, chapter));
    return true;
  };

  const getCurrentSectionChapters = (_currentBook: string): Array<{
    book: string;
    book_kor: string;
    chapters: number[];
  }> => (readingDetailResponse.value?.data?.plan_detail || []).map(detail => ({
    book: detail.book,
    book_kor: bookNames[detail.book] || detail.book,
    chapters: Array.from(
      { length: detail.end_chapter - detail.start_chapter + 1 },
      (_, index) => detail.start_chapter + index,
    ),
  }));

  /** Structured schedule rows with resolved Korean book names for header/summary consumers. */
  const getScheduleRows = (): Array<{ book: string; bookKor: string; startChapter: number; endChapter: number }> =>
    (readingDetailResponse.value?.data?.plan_detail || []).map(detail => ({
      book: detail.book,
      bookKor: bookNames[detail.book] || detail.book,
      startChapter: detail.start_chapter,
      endChapter: detail.end_chapter,
    }));

  const getFullScheduleRange = (): string => (readingDetailResponse.value?.data?.plan_detail || []).map(detail => {
    const bookName = bookNames[detail.book] || detail.book;
    const chapters = detail.start_chapter === detail.end_chapter
      ? `${detail.start_chapter}장`
      : `${detail.start_chapter}-${detail.end_chapter}장`;
    return `${bookName} ${chapters}`;
  }).join(', ');

  const completeResult = (
    status: CompleteCurrentChapterStatus,
    authoritative: AuthoritativeDetail | null,
    book: string | null,
    chapter: number | null,
    persistedScheduleIds: number[] = [],
    ok = false,
  ): CompleteCurrentChapterResult => {
    const context = authoritative?.identity || activeTongdokContext.value;
    const rows = authoritative?.rows || [];
    const progress = authoritative
      ? calculateProgress(rows, book || '', chapter || 0)
      : null;
    const completedScheduleIds = rows
      .filter(row => rowCompleted(row))
      .map(row => row.schedule_id);
    const result: CompleteCurrentChapterResult = {
      ok,
      status,
      planId: context?.planId ?? null,
      selectedScheduleId: context?.scheduleId ?? null,
      scheduleDate: context?.scheduleDate ?? null,
      markedChapter: book && chapter ? { book, chapter } : null,
      completedScheduleIds,
      persistedScheduleIds,
      scheduleCompleted: progress?.isComplete ?? false,
      progress,
    };
    lastCompleteCurrentResult.value = result;
    return result;
  };

  /**
   * Exact completion API for the reader integrator.
   *
   * It marks the current chapter locally, writes only rows for which every
   * chapter has been visited in this active session, validates the backend
   * acknowledgement, and deliberately leaves tongdok mode active on success.
   */
  const completeCurrentChapter = async (
    book: string,
    chapter: number,
  ): Promise<CompleteCurrentChapterResult> => {
    const authoritative = getAuthoritativeDetail();
    if (!authoritative) return completeResult('invalid-context', null, null, null);
    const currentRows = authoritative.rows.filter(row => rowContains(row, book, chapter));
    if (currentRows.length === 0) return completeResult('out-of-range', authoritative, null, null);
    if (
      currentRows.length !== 1 ||
      authoritative.data.book !== book ||
      positiveChapter(authoritative.data.chapter) !== chapter
    ) {
      return completeResult('invalid-context', authoritative, null, null);
    }
    if (isCompleting.value) return completeResult('busy', authoritative, null, null);

    const wasComplete = isChapterCompleted(book, chapter);
    sessionChapterMarks.add(chapterKey(book, chapter));
    const eligibleIds = authoritative.rows
      .filter(row => !rowCompleted(row) && rowChaptersMarked(row))
      .map(row => row.schedule_id);

    if (eligibleIds.length === 0) {
      const progress = calculateProgress(authoritative.rows, book, chapter);
      return completeResult(
        progress.isComplete || wasComplete ? 'already-complete' : 'progressed',
        authoritative,
        book,
        chapter,
        [],
        true,
      );
    }

    // The row-closing mark is tentative until the write is acknowledged.
    // Keep earlier chapter marks so a failed write can retry the same row.
    sessionChapterMarks.delete(chapterKey(book, chapter));

    const identitySnapshot = { ...authoritative.identity };
    const loadedSnapshot = loadedDetailIdentity ? { ...loadedDetailIdentity } : null;
    isCompleting.value = true;
    try {
      const response = await api.POST('/api/v1/todos/reading/update/', {
        plan_id: identitySnapshot.planId,
        schedule_ids: eligibleIds,
        action: 'complete',
      });
      const acknowledgedIds = Array.isArray(response?.schedule_ids)
        ? response.schedule_ids.map(positiveId).filter((id): id is number => id !== null)
        : [];
      const exactAcknowledgement = response?.success === true &&
        positiveId(response.plan_id) === identitySnapshot.planId &&
        response.is_completed === true &&
        acknowledgedIds.length === eligibleIds.length &&
        eligibleIds.every(id => acknowledgedIds.includes(id));
      if (!exactAcknowledgement) return completeResult('failed', authoritative, book, chapter);

      const contextUnchanged = activeTongdokContext.value?.planId === identitySnapshot.planId &&
        activeTongdokContext.value?.scheduleId === identitySnapshot.scheduleId &&
        activeTongdokContext.value?.scheduleDate === identitySnapshot.scheduleDate &&
        loadedSnapshot !== null && loadedDetailIdentity !== null && sameIdentity(loadedSnapshot, loadedDetailIdentity);
      if (!contextUnchanged) {
        const completed = new Set([
          ...authoritative.rows.filter(row => rowCompleted(row)).map(row => row.schedule_id),
          ...acknowledgedIds,
        ]);
        const snapshotRows = authoritative.rows.map(row => ({ ...row, is_complete: completed.has(row.schedule_id) }));
        const snapshotProgress = calculateProgress(snapshotRows, book, chapter);
        const result: CompleteCurrentChapterResult = {
          ok: true,
          status: 'stale-context',
          planId: identitySnapshot.planId,
          selectedScheduleId: identitySnapshot.scheduleId,
          scheduleDate: identitySnapshot.scheduleDate,
          markedChapter: { book, chapter },
          completedScheduleIds: [...completed],
          persistedScheduleIds: acknowledgedIds,
          scheduleCompleted: snapshotProgress.isComplete,
          progress: snapshotProgress,
        };
        lastCompleteCurrentResult.value = result;
        return result;
      }

      acknowledgedIds.forEach(id => {
        sessionPersistedScheduleIds.add(id);
        sessionCancelledScheduleIds.delete(id);
      });
      authoritative.data.plan_detail?.forEach(row => {
        const scheduleId = positiveId(row.schedule_id);
        if (scheduleId !== null && acknowledgedIds.includes(scheduleId)) row.is_complete = true;
      });
      return completeResult(
        calculateProgress(authoritative.rows, book, chapter).isComplete ? 'completed' : 'progressed',
        authoritative,
        book,
        chapter,
        acknowledgedIds,
        true,
      );
    } catch (error) {
      console.error('통독 완료 처리 실패:', error);
      return completeResult('failed', authoritative, book, chapter);
    } finally {
      isCompleting.value = false;
    }
  };

  /**
   * Undo counterpart of completeCurrentChapter.
   *
   * Cancels every completed row of the validated active range — the same set a
   * checkbox completion persists — and clears session marks for that range, so
   * an accidental completion can be rolled back. Rows only marked locally are
   * cleared without a write. The cancellation is recorded so cached or stale
   * detail cannot resurrect it.
   */
  const uncompleteCurrentChapter = async (
    book: string,
    chapter: number,
  ): Promise<CompleteCurrentChapterResult> => {
    const authoritative = getAuthoritativeDetail();
    if (!authoritative) return completeResult('invalid-context', null, null, null);
    if (isCompleting.value) return completeResult('busy', authoritative, null, null);

    const clearRangeMarks = (): void => {
      for (const row of authoritative.rows) {
        for (let rowChapter = row.start_chapter; rowChapter <= row.end_chapter; rowChapter += 1) {
          sessionChapterMarks.delete(chapterKey(row.book, rowChapter));
        }
      }
    };

    const completedIds = authoritative.rows
      .filter(row => rowCompleted(row))
      .map(row => row.schedule_id);

    if (completedIds.length === 0) {
      // Nothing persisted: only local marks can make the range look done.
      clearRangeMarks();
      return completeResult('not-complete', authoritative, book, chapter, [], true);
    }

    const identitySnapshot = { ...authoritative.identity };
    const loadedSnapshot = loadedDetailIdentity ? { ...loadedDetailIdentity } : null;
    isCompleting.value = true;
    try {
      const response = await api.POST('/api/v1/todos/reading/update/', {
        plan_id: identitySnapshot.planId,
        schedule_ids: completedIds,
        action: 'cancel',
      });
      const acknowledgedIds = Array.isArray(response?.schedule_ids)
        ? response.schedule_ids.map(positiveId).filter((id): id is number => id !== null)
        : [];
      const exactAcknowledgement = response?.success === true &&
        positiveId(response.plan_id) === identitySnapshot.planId &&
        response.is_completed === false &&
        acknowledgedIds.length === completedIds.length &&
        completedIds.every(id => acknowledgedIds.includes(id));
      if (!exactAcknowledgement) return completeResult('failed', authoritative, book, chapter);

      const contextUnchanged = activeTongdokContext.value?.planId === identitySnapshot.planId &&
        activeTongdokContext.value?.scheduleId === identitySnapshot.scheduleId &&
        activeTongdokContext.value?.scheduleDate === identitySnapshot.scheduleDate &&
        loadedSnapshot !== null && loadedDetailIdentity !== null && sameIdentity(loadedSnapshot, loadedDetailIdentity);
      if (!contextUnchanged) {
        const remaining = new Set(
          authoritative.rows
            .filter(row => rowCompleted(row) && !acknowledgedIds.includes(row.schedule_id))
            .map(row => row.schedule_id),
        );
        const snapshotRows = authoritative.rows.map(row => ({ ...row, is_complete: remaining.has(row.schedule_id) }));
        const snapshotProgress = calculateProgress(snapshotRows, book, chapter);
        const result: CompleteCurrentChapterResult = {
          ok: true,
          status: 'stale-context',
          planId: identitySnapshot.planId,
          selectedScheduleId: identitySnapshot.scheduleId,
          scheduleDate: identitySnapshot.scheduleDate,
          markedChapter: { book, chapter },
          completedScheduleIds: [...remaining],
          persistedScheduleIds: acknowledgedIds,
          scheduleCompleted: snapshotProgress.isComplete,
          progress: snapshotProgress,
        };
        lastCompleteCurrentResult.value = result;
        return result;
      }

      acknowledgedIds.forEach(id => {
        sessionCancelledScheduleIds.add(id);
        sessionPersistedScheduleIds.delete(id);
      });
      clearRangeMarks();
      authoritative.data.plan_detail?.forEach(row => {
        const scheduleId = positiveId(row.schedule_id);
        if (scheduleId !== null && acknowledgedIds.includes(scheduleId)) row.is_complete = false;
      });
      return completeResult('cancelled', authoritative, book, chapter, acknowledgedIds, true);
    } catch (error) {
      console.error('통독 완료 취소 실패:', error);
      return completeResult('failed', authoritative, book, chapter);
    } finally {
      isCompleting.value = false;
    }
  };

  /** Legacy boolean API. True now means the validated current range is complete. */
  const completeReading = async (book?: string, chapter?: number): Promise<boolean> => {
    const data = readingDetailResponse.value?.data;
    const targetBook = book || data?.book;
    const targetChapter = chapter ?? positiveChapter(data?.chapter);
    if (!targetBook || !targetChapter) {
      lastCompleteCurrentResult.value = completeResult('invalid-context', null, null, null);
      return false;
    }
    const result = await completeCurrentChapter(targetBook, targetChapter);
    return result.ok && result.scheduleCompleted;
  };

  return {
    tongdokMode,
    tongdokScheduleId,
    tongdokPlanId,
    tongdokScheduleDate,
    activeTongdokContext,
    readingDetailResponse,
    isCompleting,
    lastCompleteCurrentResult,

    initTongdokMode,
    getTongdokScheduleRange,
    getScheduleRows,
    getFullScheduleRange,
    isLastChapterInTongdok,
    isChapterCompleted,
    isScheduleCompleted,
    disableTongdokMode,
    enableTongdokMode,
    setReadingDetailResponse,
    getCurrentSectionChapters,
    markCurrentChapter,
    markAllScheduleChapters,
    completeCurrentChapter,
    uncompleteCurrentChapter,
    completeReading,
    loadReadingDetail,
    getAudioLink,
    getGuideLink,
    getScheduleDate,
    getTongdokProgress,
  };
};
