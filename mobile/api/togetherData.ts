import type { ApiFetch, ApiFetchInit } from './nativeApi';
import {
  array, record, number, parseGroup, parseMember, parseStat, parseProgress, parseSchedule, TogetherDataError,
  text, type ReadingGroup,
} from '../components/together/contracts';

export type GroupFilter = 'all' | 'public' | 'mine';
export interface GroupQuery { readonly search: string; readonly filter: GroupFilter }

async function request(apiFetch: ApiFetch, path: string, init: ApiFetchInit = { method: 'GET' }): Promise<unknown> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error : '요청을 처리할 수 없습니다. 다시 시도해 주세요.';
    throw new TogetherDataError(message, response.status);
  }
  return response.json();
}
async function envelope(apiFetch: ApiFetch, path: string, init?: ApiFetchInit) {
  const body = record(await request(apiFetch, path, init));
  if (body.success !== true) throw new TogetherDataError(typeof body.error === 'string' ? body.error : undefined);
  return body;
}
export async function fetchGroups(apiFetch: ApiFetch, query: GroupQuery): Promise<ReadingGroup[]> {
  const params = new URLSearchParams({ search: query.search });
  if (query.filter === 'public') params.set('only_public', 'true');
  if (query.filter === 'mine') params.set('only_mine', 'true');
  const body = await envelope(apiFetch, `/api/v1/todos/groups/?${params}`);
  return [...new Map(array(body.groups, parseGroup).map((group) => [group.id, group])).values()];
}
export async function fetchGroup(apiFetch: ApiFetch, id: number) {
  const group = parseGroup((await envelope(apiFetch, `/api/v1/todos/groups/${id}/`)).group);
  if (group.id !== id) throw new TogetherDataError();
  return group;
}
export async function joinGroup(apiFetch: ApiFetch, id: number): Promise<void> {
  await envelope(apiFetch, `/api/v1/todos/groups/${id}/join/`, { method: 'POST' });
}
export interface CreateGroupInput {
  readonly name: string;
  readonly description: string;
  readonly plan_ids: readonly number[];
  readonly max_members: number;
  readonly is_public: boolean;
}
export async function createGroup(apiFetch: ApiFetch, input: CreateGroupInput) {
  return parseGroup((await envelope(apiFetch, '/api/v1/todos/groups/create/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })).group);
}
export async function leaveGroup(apiFetch: ApiFetch, id: number): Promise<void> {
  await envelope(apiFetch, `/api/v1/todos/groups/${id}/leave/`, { method: 'POST' });
}
export async function fetchCreationPlans(apiFetch: ApiFetch) {
  return array((await envelope(apiFetch, '/api/v1/todos/plans/')).plans, (entry) => {
    const plan = record(entry);
    return { id: number(plan.id), name: text(plan.name) };
  });
}
export async function fetchMembers(apiFetch: ApiFetch, id: number) {
  const body = await envelope(apiFetch, `/api/v1/todos/groups/${id}/members/`);
  const meta = record(body.meta);
  return { members: array(body.members, parseMember), total: number(meta.total_members), hasMore: meta.has_more === true };
}
export async function fetchStats(apiFetch: ApiFetch, selection: { groupId: number; planId: number }) {
  const body = await envelope(apiFetch, `/api/v1/todos/scoreboard/group/${selection.groupId}/?period=all&plan_id=${selection.planId}`);
  return array(body.leaderboard, parseStat);
}
export async function fetchProgress(apiFetch: ApiFetch, selection: { groupId: number; planId: number; year: number; month: number }) {
  const body = await envelope(apiFetch, `/api/v1/todos/groups/${selection.groupId}/member-progress/?plan_id=${selection.planId}&year=${selection.year}&month=${selection.month}`);
  return parseProgress(body.calendar);
}
export async function fetchGroupSchedules(apiFetch: ApiFetch, selection: { planId: number; year: number; month: number }) {
  return array(await request(apiFetch, `/api/v1/todos/schedules/month/?plan_id=${selection.planId}&year=${selection.year}&month=${selection.month}`), parseSchedule);
}
