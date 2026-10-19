import type { Achievement, CalendarData, CalendarEntry, Profile, ProfileGroup, ProfilePerson } from './profileTypes';

export class ProfileDataError extends Error {
  constructor(message = '응답을 확인하지 못했어요. 다시 시도해 주세요.', readonly status?: number) {
    super(message);
    this.name = 'ProfileDataError';
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new ProfileDataError();
  return value;
}
export function text(value: unknown): string {
  if (typeof value !== 'string') throw new ProfileDataError();
  return value;
}
export function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ProfileDataError();
  return value;
}
export function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new ProfileDataError();
  return value;
}
export function list<T>(value: unknown, parse: (row: unknown) => T): readonly T[] {
  if (!Array.isArray(value)) throw new ProfileDataError();
  return value.map(parse);
}
function user(value: unknown) {
  const u = record(value);
  return { id: number(u.id), username: text(u.username), nickname: text(u.nickname),
    profile_image: u.profile_image == null ? null : text(u.profile_image) };
}
export function parseProfile(value: unknown): Profile {
  const p = record(value);
  return {
    id: number(p.id), user: user(p.user), bio: text(p.bio),
    total_completed_days: number(p.total_completed_days), current_streak: number(p.current_streak),
    longest_streak: number(p.longest_streak), joined_date: text(p.joined_date), is_public: bool(p.is_public),
    followers_count: number(p.followers_count), following_count: number(p.following_count),
    is_following: bool(p.is_following), is_mutual_follow: bool(p.is_mutual_follow),
  };
}
function parseEntry(value: unknown): CalendarEntry {
  const r = record(value);
  return {
    date: text(r.date), is_completed: bool(r.is_completed), book: text(r.book), chapters: text(r.chapters),
    start_chapter: number(r.start_chapter), end_chapter: number(r.end_chapter), plan_id: number(r.plan_id),
    plan_name: text(r.plan_name), color: text(r.color), schedule_id: number(r.schedule_id), schedule_text: text(r.schedule_text),
  };
}
function plan(value: unknown) {
  const p = record(value);
  return { id: number(p.id), name: text(p.name) };
}
export function parseCalendar(value: unknown): CalendarData {
  const d = record(value);
  return { calendar: list(d.calendar, parseEntry), plans: list(d.plans, p => ({ ...plan(p), color: text(record(p).color) })) };
}
export function parseAchievement(value: unknown): Achievement {
  const a = record(value);
  return { id: a.id === null ? null : number(a.id), achievement_type: text(a.achievement_type),
    title: text(a.title), description: text(a.description), icon: text(a.icon), order: number(a.order),
    unlocked: bool(a.unlocked), unlockedAt: a.unlockedAt === null ? null : text(a.unlockedAt),
    milestone_value: number(a.milestone_value) };
}
export function parseGroup(value: unknown): ProfileGroup {
  const g = record(value);
  return { id: number(g.id), name: text(g.name), description: text(g.description), plans: list(g.plans, plan),
    is_public: bool(g.is_public), member_count: number(g.member_count), max_members: number(g.max_members),
    my_role: g.my_role === null ? null : text(g.my_role), show_in_profile: bool(g.show_in_profile) };
}
export function parsePerson(value: unknown): ProfilePerson {
  const p = record(value);
  return { ...user(p), is_following: bool(p.is_following), total_completed_days: number(p.total_completed_days) };
}
