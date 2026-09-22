import {
  chapterCount, resolveBibleBookCode, type BibleReaderRoute,
  type ChapterRef, type ReaderTongdokContext,
} from './bibleBooks';
import { normalizeMonthSchedules, type ScheduleEntry } from './scheduleData';
import type { ApiFetch, ApiFetchInit } from './nativeApi';

export interface TongdokRow {
  readonly id: number;
  readonly book: string;
  readonly start: number;
  readonly end: number;
  readonly date: string;
  readonly complete: boolean;
}
export interface TongdokDetail {
  readonly name: string;
  readonly date: string;
  readonly rows: readonly TongdokRow[];
}
export interface TongdokState {
  readonly context: ReaderTongdokContext;
  readonly location: ChapterRef;
  readonly detail: TongdokDetail | null;
  readonly loading: boolean;
  readonly busy: boolean;
  readonly error: 'detail' | 'update' | 'next' | 'guest' | null;
  readonly completedNotice: boolean;
  readonly allCompleted: boolean;
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const id = (v: unknown): number | null => {
  const n = typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const OFF: ReaderTongdokContext = { enabled: false, planId: null, scheduleId: null, date: null };
const contains = (row: TongdokRow, loc: ChapterRef) =>
  row.book === loc.book && loc.chapter >= row.start && loc.chapter <= row.end;

/** Fail closed: no mutation from a partial, mismatched or out-of-range detail. */
function parseDetail(value: unknown, state: TongdokState): TongdokDetail | null {
  if (!record(value) || id(value.plan_id) !== state.context.planId
    || value.book !== state.location.book || id(value.chapter) !== state.location.chapter) return null;
  if (!Array.isArray(value.plan_detail) || value.plan_detail.length === 0) return null;
  if (typeof value.plan_date !== 'string'
    || (state.context.date && state.context.date !== value.plan_date)) return null;
  const rows: TongdokRow[] = [];
  for (const raw of value.plan_detail) {
    if (!record(raw)) return null;
    const rowId = id(raw.schedule_id);
    const book = typeof raw.book === 'string' ? resolveBibleBookCode(raw.book) : null;
    const start = id(raw.start_chapter), end = id(raw.end_chapter);
    if (!rowId || !book || !start || !end || end < start || end > chapterCount(book)
      || raw.date !== value.plan_date || typeof raw.is_complete !== 'boolean') return null;
    rows.push({ id: rowId, book, start, end, date: raw.date, complete: raw.is_complete });
  }
  if (new Set(rows.map(r => r.id)).size !== rows.length
    || !rows.some(r => contains(r, state.location))
    || (state.context.scheduleId !== null && !rows.some(r => r.id === state.context.scheduleId))) return null;
  return { name: typeof value.plan_name === 'string' ? value.plan_name : '', date: value.plan_date, rows };
}

export function scheduleTarget(row: ScheduleEntry, planId: number): BibleReaderRoute | null {
  const book = resolveBibleBookCode(row.book);
  if (!book || row.plan !== planId || row.start_chapter < 1 || row.end_chapter < row.start_chapter
    || row.end_chapter > chapterCount(book)) return null;
  return { location: { book, chapter: row.start_chapter }, version: null,
    context: { enabled: true, planId, scheduleId: row.id, date: row.date } };
}

/** One controller per reader, never per tab. Every async result is identity-scoped. */
export function createReaderTongdok(fetch: ApiFetch) {
  let state: TongdokState = { context: OFF, location: { book: 'gen', chapter: 1 },
    detail: null, loading: false, busy: false, error: null, completedNotice: false, allCompleted: false };
  let generation = 0, loadGeneration = 0;
  // Session evidence survives chapter/tab moves, but not entry/account/plan changes.
  const heard = new Set<string>();
  const heardKey = (row: TongdokRow, chapter: number) =>
    JSON.stringify([state.context.planId, row.date, row.id, row.book, row.start, row.end, chapter]);
  let retryWrite: { ids: readonly number[]; complete: boolean; audio: boolean } | null = null;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<TongdokState>) => {
    state = { ...state, ...patch };
    listeners.forEach(fn => fn());
  };
  const reset = (context: ReaderTongdokContext, location = state.location) => {
    generation++; loadGeneration++;
    retryWrite = null;
    publish({ context, location, detail: null, loading: false, busy: false, error: null,
      completedNotice: false, allCompleted: false });
  };
  async function json(path: string, init?: ApiFetchInit): Promise<unknown> {
    const response = await fetch(path, init);
    if (!response.ok) throw new Error(`Tongdok HTTP ${response.status}`);
    return response.json();
  }
  async function writeProgress(write: { ids: readonly number[]; complete: boolean; audio: boolean }) {
    const snapshot = state, token = generation;
    if (snapshot.busy || snapshot.loading || !snapshot.detail || snapshot.context.planId === null) return;
    retryWrite = write;
    publish({ busy: true, error: null });
    try {
      const ack = await json('/api/v1/todos/reading/update/', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: snapshot.context.planId, schedule_ids: write.ids,
          action: write.complete ? 'complete' : 'cancel' }) });
      if (token !== generation) return;
      const ids = record(ack) && Array.isArray(ack.schedule_ids) ? ack.schedule_ids.map(id) : [];
      if (!record(ack) || ack.success !== true || id(ack.plan_id) !== snapshot.context.planId
        || ack.is_completed !== write.complete || ids.length !== write.ids.length
        || new Set(ids).size !== write.ids.length || !write.ids.every(n => ids.includes(n))) {
        publish({ busy: false, error: 'update' }); return;
      }
      loadGeneration++;
      retryWrite = null;
      if (!write.complete) heard.clear();
      const rows = snapshot.detail.rows.map(row =>
        write.ids.includes(row.id) ? { ...row, complete: write.complete } : row);
      publish({ busy: false, completedNotice: write.complete && rows.every(row => row.complete),
        detail: { ...snapshot.detail, rows } });
    } catch {
      if (token === generation) publish({ busy: false, error: 'update' });
    }
  }
  const controller = {
    getState: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    enter(route: BibleReaderRoute) { heard.clear(); reset(route.context, route.location ?? state.location); },
    exit() { heard.clear(); reset(OFF); },
    invalidate() { heard.clear(); reset(state.context); },
    dismissNotice() { publish({ completedNotice: false }); },
    setDefaultPlan(planId: number | null) {
      if (state.context.enabled && state.context.planId === null && planId !== null)
        reset({ ...state.context, planId });
    },
    move(location: ChapterRef) {
      if (location.book === state.location.book && location.chapter === state.location.chapter) return;
      // Keep the global plan, not the entry day's constraints. Only a verified
      // detail for the new passage may establish its date and schedule.
      reset({ ...state.context, date: null, scheduleId: null }, location);
    },
    async load() {
      const snapshot = state, token = generation, request = ++loadGeneration;
      if (!snapshot.context.enabled || snapshot.context.planId === null) return;
      publish({ loading: true, error: null });
      try {
        const query = new URLSearchParams({ book: snapshot.location.book,
          chapter: String(snapshot.location.chapter), plan_id: String(snapshot.context.planId) });
        const value = await json(`/api/v1/todos/detail/?${query}`);
        if (token !== generation || request !== loadGeneration) return;
        const detail = parseDetail(value, snapshot);
        const selected = detail?.rows.find(row => contains(row, snapshot.location));
        publish({ detail, loading: false, context: detail ? {
          ...snapshot.context, date: detail.date,
          scheduleId: snapshot.context.scheduleId ?? selected?.id ?? null,
        } : snapshot.context });
      } catch {
        if (token === generation && request === loadGeneration) publish({ loading: false, error: 'detail' });
      }
    },
    async toggle(signedIn: boolean) {
      if (!signedIn) { publish({ error: 'guest' }); return; }
      const snapshot = state;
      if (snapshot.busy || snapshot.loading || !snapshot.detail || snapshot.context.planId === null) return;
      await writeProgress({ ids: snapshot.detail.rows.map(row => row.id),
        complete: !snapshot.detail.rows.every(row => row.complete), audio: false });
    },
    async heardChapter(signedIn: boolean) {
      if (!signedIn) return;
      const snapshot = state;
      if (snapshot.busy || snapshot.loading || !snapshot.detail || !snapshot.context.enabled) return;
      const current = snapshot.detail.rows.filter(row => contains(row, snapshot.location));
      if (current.length !== 1) return;
      heard.add(heardKey(current[0], snapshot.location.chapter));
      const ids = snapshot.detail.rows.filter(row => !row.complete
        && Array.from({ length: row.end - row.start + 1 }, (_, i) => row.start + i)
          .every(chapter => heard.has(heardKey(row, chapter)))).map(row => row.id);
      if (ids.length) await writeProgress({ ids, complete: true, audio: true });
    },
    async retryUpdate(signedIn: boolean, autoComplete: boolean) {
      if (!signedIn) { publish({ error: 'guest' }); return; }
      if (retryWrite && (!retryWrite.audio || autoComplete)) await writeProgress(retryWrite);
    },
    async month(month: number, year?: number) {
      const planId = state.context.planId;
      if (planId === null) return [];
      const query = new URLSearchParams({ plan_id: String(planId), month: String(month) });
      if (year !== undefined) query.set('year', String(year));
      return normalizeMonthSchedules(await json(`/api/v1/todos/schedules/month/?${query}`));
    },
    async next(): Promise<BibleReaderRoute | null> {
      const token = generation, planId = state.context.planId;
      if (planId === null || state.busy) return null;
      publish({ busy: true, error: null, allCompleted: false });
      try {
        const position = await json(`/api/v1/todos/next-position/?plan_id=${planId}`);
        if (token !== generation) return null;
        if (record(position) && position.status === 'all_completed') {
          publish({ busy: false, allCompleted: true }); return null;
        }
        if (!record(position) || !['next_incomplete', 'today', 'nearest'].includes(String(position.status))
          || !id(position.schedule_id) || !id(position.month) || Number(position.month) > 12) {
          publish({ busy: false, error: 'next' }); return null;
        }
        const schedules = await controller.month(Number(position.month));
        if (token !== generation) return null;
        const row = schedules.find(r => r.id === id(position.schedule_id));
        const target = row ? scheduleTarget(row, planId) : null;
        publish({ busy: false, error: target ? null : 'next' });
        return target;
      } catch {
        if (token === generation) publish({ busy: false, error: 'next' });
        return null;
      }
    },
  };
  return controller;
}
export type ReaderTongdok = ReturnType<typeof createReaderTongdok>;
