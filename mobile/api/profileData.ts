import type { ApiFetch, ApiFetchInit } from './nativeApi';
import { resolveBibleBookCode } from './bibleBooks';
import {
  bool, list, number, parseAchievement, parseCalendar, parseGroup, parsePerson,
  parseProfile, ProfileDataError, record,
} from '../components/profile/profileParsing';
import type { CalendarEntry, ProfileDraft } from '../components/profile/profileTypes';

async function request(apiFetch: ApiFetch, path: string, init?: ApiFetchInit) {
  const response = await apiFetch(path, init);
  if (!response.ok) throw new ProfileDataError(
    response.status === 403 ? '이 프로필을 볼 수 없어요.' : '불러오지 못했어요. 다시 시도해 주세요.', response.status,
  );
  const json = record(await response.json());
  if (json.success !== true) throw new ProfileDataError(
    typeof json.error === 'string' ? json.error : '요청을 처리하지 못했어요. 다시 시도해 주세요.',
  );
  return json;
}
const jsonBody = (method: string, body: object): ApiFetchInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
// null alone means the own-profile default. Invalid targets never fall back to it.
export function profileTargetId(url?: string): number | null {
  if (!url) return null;
  try {
    const path = new URL(url, 'https://maeil1dok.app').pathname;
    if (/^\/profile\/?$/.test(path)) return null;
    const match = /^\/profile\/([1-9]\d*)\/?$/.exec(path);
    const id = match ? Number(match[1]) : NaN;
    return Number.isSafeInteger(id) ? id : NaN;
  } catch {
    return NaN;
  }
}
export async function loadOwnProfile(apiFetch: ApiFetch) {
  return loadProfile(apiFetch, await loadViewerId(apiFetch));
}
export async function loadViewerId(apiFetch: ApiFetch) {
  const response = await apiFetch('/api/v1/auth/user/');
  if (!response.ok) throw new ProfileDataError('내 정보를 불러오지 못했어요. 다시 시도해 주세요.', response.status);
  return number(record(await response.json()).id);
}
export async function loadProfile(apiFetch: ApiFetch, id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new ProfileDataError('프로필 주소를 확인해 주세요.');
  const result = await request(apiFetch, `/api/v1/auth/profile/${id}/`);
  const profile = parseProfile(record(result.data).profile);
  if (profile.user.id !== id) throw new ProfileDataError();
  return profile;
}
export async function loadCalendar(apiFetch: ApiFetch, id: number, month: string) {
  const [year, m] = month.split('-');
  return parseCalendar((await request(apiFetch, `/api/v1/auth/profile/${id}/calendar/?year=${year}&month=${Number(m)}`)).data);
}
export async function loadAchievements(apiFetch: ApiFetch, id: number) {
  return list(record((await request(apiFetch, `/api/v1/auth/profile/${id}/achievements/`)).data).achievements, parseAchievement);
}
export async function loadGroups(apiFetch: ApiFetch, targetId?: number) {
  return list((await request(apiFetch, targetId === undefined
    ? '/api/v1/todos/groups/?only_mine=true'
    : `/api/v1/todos/users/${targetId}/groups/`)).groups, parseGroup);
}
export async function updateGroupVisibility(apiFetch: ApiFetch, id: number, visible: boolean) {
  const result = await request(apiFetch, `/api/v1/todos/groups/${id}/visibility/`, jsonBody('PATCH', { show_in_profile: visible }));
  return bool(result.show_in_profile);
}
export async function saveProfile(apiFetch: ApiFetch, id: number, draft: ProfileDraft) {
  if (draft.bio.length > 500) throw new ProfileDataError('자기소개는 500자까지 쓸 수 있어요.');
  const result = await request(apiFetch, '/api/v1/auth/profile/', jsonBody('PUT', { bio: draft.bio, is_public: draft.is_public }));
  const profile = parseProfile(record(result.data).profile);
  if (profile.user.id !== id) throw new ProfileDataError();
  return profile;
}
export async function loadPeople(apiFetch: ApiFetch, id: number, kind: 'followers' | 'following') {
  const data = record((await request(apiFetch, `/api/v1/auth/${kind}/${id}/`)).data);
  return list(data[kind], parsePerson);
}
export async function togglePersonFollow(apiFetch: ApiFetch, id: number, following: boolean) {
  if (following) {
    await request(apiFetch, `/api/v1/auth/unfollow/${id}/`, { method: 'DELETE' });
  } else {
    await request(apiFetch, '/api/v1/auth/follow/', jsonBody('POST', { user_id: id }));
  }
}
export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function shiftMonth(month: string, amount: number): string {
  const [year, m] = month.split('-').map(Number);
  return localDate(new Date(year, m - 1 + amount, 1)).slice(0, 7);
}
export function calendarCells(month: string, rows: readonly CalendarEntry[], today: string) {
  const [year, m] = month.split('-').map(Number);
  const first = new Date(year, m - 1, 1);
  const start = 1 - first.getDay();
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(year, m - 1, start + index);
    const date = localDate(day);
    const current = date.startsWith(`${month}-`);
    const schedules = current ? rows.filter(row => row.date === date) : [];
    const state = !current ? 'outside'
      : schedules.length > 0 && schedules.every(row => row.is_completed) ? 'completed'
        : date === today ? 'today'
          : schedules.length === 0 ? 'empty'
            : date > today ? 'future' : 'missed';
    return { date, day: day.getDate(), current, schedules, state };
  });
}
export function readingUrl(row: CalendarEntry): string | null {
  const book = resolveBibleBookCode(row.book);
  if (!book) return null;
  return `/bible?${new URLSearchParams({
    book, chapter: String(row.start_chapter), plan: String(row.plan_id),
    schedule: String(row.schedule_id), date: row.date, tongdok: 'true',
  })}`;
}
