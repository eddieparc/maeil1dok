// Projections of backend/schema.yml; only fields consumed by this feature.
export interface GroupPerson {
  readonly id: number;
  readonly nickname: string;
  readonly profile_image: string | null;
}
export interface GroupPlan {
  readonly id: number;
  readonly name: string;
}
export interface ReadingGroup {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly creator: GroupPerson;
  readonly plans: readonly GroupPlan[];
  readonly is_public: boolean;
  readonly max_members: number;
  readonly member_count: number;
  readonly is_full: boolean;
  readonly is_member: boolean;
  readonly my_role: string | null;
}
export interface GroupMember {
  readonly user: GroupPerson;
  readonly role: string;
  readonly joined_at: string;
}
export interface MemberStat {
  readonly user: { readonly id: number };
  readonly progress_rate: number;
  readonly current_streak: number;
}
export interface ProgressDay {
  readonly members: readonly { readonly id: number; readonly is_completed: boolean }[];
}
export interface GroupSchedule {
  readonly id: number;
  readonly date: string;
  readonly book: string;
  readonly start_chapter: number;
  readonly end_chapter: number;
  readonly is_completed: boolean | null;
}
export class TogetherDataError extends Error {
  constructor(message = '그룹 정보를 불러올 수 없습니다.', readonly status?: number) {
    super(message);
    this.name = 'TogetherDataError';
  }
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const record = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new TogetherDataError();
  return value;
};
export const text = (value: unknown): string => {
  if (typeof value !== 'string') throw new TogetherDataError();
  return value;
};
export const number = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TogetherDataError();
  return value;
};
const bool = (value: unknown): boolean => {
  if (typeof value !== 'boolean') throw new TogetherDataError();
  return value;
};
export function array<T>(value: unknown, parse: (entry: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new TogetherDataError();
  return value.map(parse);
}
function person(value: unknown): GroupPerson {
  const raw = record(value);
  return { id: number(raw.id), nickname: text(raw.nickname), profile_image: raw.profile_image == null ? null : text(raw.profile_image) };
}
export function parseGroup(value: unknown): ReadingGroup {
  const raw = record(value);
  return {
    id: number(raw.id), name: text(raw.name), description: text(raw.description),
    creator: person(raw.creator),
    plans: array(raw.plans, (entry) => { const plan = record(entry); return { id: number(plan.id), name: text(plan.name) }; }),
    is_public: bool(raw.is_public), max_members: number(raw.max_members), member_count: number(raw.member_count),
    is_full: bool(raw.is_full), is_member: bool(raw.is_member), my_role: raw.my_role === null ? null : text(raw.my_role),
  };
}
export function parseMember(value: unknown): GroupMember {
  const raw = record(value);
  return { user: person(raw.user), role: text(raw.role), joined_at: text(raw.joined_at) };
}
export function parseStat(value: unknown): MemberStat {
  const raw = record(value);
  return { user: { id: number(record(raw.user).id) }, progress_rate: number(raw.progress_rate), current_streak: number(raw.current_streak) };
}
export function parseProgress(value: unknown): Readonly<Record<string, ProgressDay>> {
  return Object.fromEntries(Object.entries(record(value)).map(([date, day]) => [date, {
    members: array(record(day).members, (entry) => {
      const member = record(entry);
      return { id: number(member.id), is_completed: bool(member.is_completed) };
    }),
  }]));
}
export function parseSchedule(value: unknown): GroupSchedule {
  const raw = record(value);
  return {
    id: number(raw.id), date: text(raw.date), book: text(raw.book),
    start_chapter: number(raw.start_chapter), end_chapter: number(raw.end_chapter),
    is_completed: raw.is_completed === undefined ? null : bool(raw.is_completed),
  };
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '그룹 정보를 불러올 수 없습니다.';
