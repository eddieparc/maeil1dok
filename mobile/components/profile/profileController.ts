import { AuthExpiredError, type ApiFetch } from '../../api/nativeApi';
import {
  loadAchievements, loadCalendar, loadGroups, loadProfile, loadViewerId, loadPeople,
  saveProfile, shiftMonth, togglePersonFollow, updateGroupVisibility,
} from '../../api/profileData';
import type { ProfileDraft, ProfileState, ProfileTab, ReadyProfile } from './profileTypes';
import { ProfileDataError } from './profileParsing';

const message = (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했어요.';

// Each instance belongs to one auth token + API stack + target. dispose invalidates every
// pending read/write; independent counters also isolate month and modal requests.
export function createProfileController(options: {
  readonly apiFetch: ApiFetch;
  readonly status: 'loading' | 'signedOut' | 'signedIn';
  readonly month: string;
  readonly targetId?: number | null;
}) {
  let state: ProfileState = options.status === 'signedOut' && options.targetId == null ? { kind: 'guest' } : { kind: 'loading' };
  let active = true;
  let generation = 0;
  let calendarGeneration = 0;
  let peopleGeneration = 0;
  const listeners = new Set<() => void>();
  const emit = (next: ProfileState) => {
    if (!active) return;
    state = next;
    listeners.forEach(listener => listener());
  };
  const patch = (values: Partial<ReadyProfile>) => {
    if (state.kind === 'ready') emit({ ...state, ...values });
  };
  const current = (g: number) => active && g === generation;
  async function calendar(month: string) {
    if (state.kind !== 'ready') return;
    const g = generation;
    const version = ++calendarGeneration;
    const id = state.profile.user.id;
    patch({ month, selectedDate: null, calendar: { kind: 'loading' } });
    try {
      const data = await loadCalendar(options.apiFetch, id, month);
      if (current(g) && version === calendarGeneration) patch({ calendar: { kind: 'ready', data } });
    } catch (error) {
      if (current(g) && version === calendarGeneration) patch({ calendar: { kind: 'error', message: message(error) } });
    }
  }
  async function start() {
    if (!active || options.status === 'loading' || (options.status === 'signedOut' && options.targetId == null)) return;
    const g = ++generation;
    emit({ kind: 'loading' });
    try {
      const viewerId = options.status === 'signedIn' ? await loadViewerId(options.apiFetch) : null;
      if (!current(g)) return;
      const id = options.targetId ?? viewerId;
      if (id === null) return;
      const profile = await loadProfile(options.apiFetch, id);
      if (!current(g)) return;
      emit({ kind: 'ready', profile, viewerId, isOwnProfile: viewerId === profile.user.id,
        avatarFailed: false, tab: 'calendar', month: options.month,
        calendar: { kind: 'loading' }, achievements: null, groups: null,
        selectedDate: null, achievementTab: 'bible', showHiddenGroups: false,
        editor: null, people: null, pendingGroup: null, pendingPerson: null, actionError: null });
      await calendar(options.month);
    } catch (error) {
      if (current(g)) {
        const status = error instanceof AuthExpiredError ? 401 : error instanceof ProfileDataError ? error.status : undefined;
        if (status === 401) emit({ kind: 'unauthorized' });
        else if (status === 403) emit({ kind: 'forbidden' });
        else if (status === 404) emit({ kind: 'unavailable' });
        else emit({ kind: 'error', message: message(error) });
      }
    }
  }
  async function selectTab(tab: ProfileTab, retry = false) {
    if (!active || state.kind !== 'ready') return;
    patch({ tab, actionError: null });
    if (tab === 'calendar') {
      if (retry) await calendar(state.month);
      return;
    }
    if (!retry && state[tab] !== null) return;
    const g = generation;
    const id = state.profile.user.id;
    patch({ [tab]: { kind: 'loading' } });
    try {
      if (tab === 'achievements') {
        const data = await loadAchievements(options.apiFetch, id);
        if (current(g)) patch({ achievements: { kind: 'ready', data } });
      } else {
        const data = await loadGroups(options.apiFetch, state.isOwnProfile ? undefined : id);
        if (current(g)) patch({ groups: { kind: 'ready', data } });
      }
    } catch (error) {
      if (current(g)) patch({ [tab]: { kind: 'error', message: message(error) } });
    }
  }
  async function save() {
    if (!active || state.kind !== 'ready' || !state.isOwnProfile || !state.editor || state.editor.saving) return;
    const g = generation;
    const draft = state.editor;
    const id = state.profile.user.id;
    patch({ editor: { ...draft, saving: true, error: null } });
    try {
      const profile = await saveProfile(options.apiFetch, id, draft);
      if (current(g)) patch({ profile, editor: null });
    } catch (error) {
      if (current(g)) patch({ editor: { ...draft, saving: false, error: message(error) } });
    }
  }
  async function visibility(id: number) {
    if (!active || state.kind !== 'ready' || !state.isOwnProfile || state.pendingGroup !== null || state.groups?.kind !== 'ready') return;
    const group = state.groups.data.find(row => row.id === id);
    if (!group) return;
    const g = generation;
    patch({ pendingGroup: id, actionError: null });
    try {
      const visible = await updateGroupVisibility(options.apiFetch, id, !group.show_in_profile);
      if (current(g) && state.groups?.kind === 'ready') patch({
        groups: { kind: 'ready', data: state.groups.data.map(row => row.id === id ? { ...row, show_in_profile: visible } : row) },
      });
    } catch (error) {
      if (current(g)) patch({ actionError: message(error) });
    } finally {
      if (current(g)) patch({ pendingGroup: null });
    }
  }
  async function people(kind: 'followers' | 'following') {
    if (!active || state.kind !== 'ready') return;
    const g = generation;
    const version = ++peopleGeneration;
    const id = state.profile.user.id;
    patch({ people: { kind, result: { kind: 'loading' } }, actionError: null });
    try {
      const data = await loadPeople(options.apiFetch, id, kind);
      if (current(g) && version === peopleGeneration) patch({ people: { kind, result: { kind: 'ready', data } } });
    } catch (error) {
      if (current(g) && version === peopleGeneration) patch({ people: { kind, result: { kind: 'error', message: message(error) } } });
    }
  }
  async function follow(id: number) {
    if (!active || state.kind !== 'ready' || state.viewerId === null || state.pendingPerson !== null) return;
    const person = id === state.profile.user.id ? { id, is_following: state.profile.is_following }
      : state.people?.result.kind === 'ready' ? state.people.result.data.find(row => row.id === id) : undefined;
    if (!person || person.id === state.viewerId) return;
    const g = generation;
    const kind = state.people?.kind;
    const profileId = state.profile.user.id;
    patch({ pendingPerson: id, actionError: null });
    try {
      await togglePersonFollow(options.apiFetch, id, person.is_following);
      if (current(g)) {
        // Refetch authoritative counts rather than deriving profile metrics.
        const profile = await loadProfile(options.apiFetch, profileId);
        if (current(g)) {
          patch({ profile });
          if (kind && state.people?.kind === kind) await people(kind);
        }
      }
    } catch (error) {
      if (current(g)) patch({ actionError: message(error) });
    } finally {
      if (current(g)) patch({ pendingPerson: null });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start,
    activate: () => { active = true; },
    dispose: () => { active = false; generation++; calendarGeneration++; peopleGeneration++; },
    selectTab, save, visibility, people, follow,
    changeMonth: async (amount: number) => {
      if (active && state.kind === 'ready') {
        const next = shiftMonth(state.month, amount);
        if (next <= options.month) await calendar(next);
      }
    },
    openEdit: () => {
      if (active && state.kind === 'ready' && state.isOwnProfile) patch({
        editor: { bio: state.profile.bio, is_public: state.profile.is_public, saving: false, error: null },
      });
    },
    edit: (draft: ProfileDraft) => {
      if (state.kind === 'ready' && state.editor && !state.editor.saving) patch({
        editor: { ...draft, saving: false, error: null },
      });
    },
    closeEdit: () => { if (state.kind === 'ready' && !state.editor?.saving) patch({ editor: null }); },
    selectDate: (selectedDate: string | null) => patch({ selectedDate }),
    achievementTab: (achievementTab: 'bible' | 'hasena') => patch({ achievementTab }),
    hiddenGroups: () => { if (state.kind === 'ready') patch({ showHiddenGroups: !state.showHiddenGroups }); },
    closePeople: () => { peopleGeneration++; patch({ people: null }); },
    reportError: (error: unknown) => patch({ actionError: message(error) }),
    avatarFailed: () => patch({ avatarFailed: true }),
  };
}
export type ProfileController = ReturnType<typeof createProfileController>;
