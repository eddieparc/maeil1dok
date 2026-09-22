import type { ApiFetch } from '../../api/nativeApi';
import { fetchGroups, fetchGroup, joinGroup, createGroup, leaveGroup, fetchCreationPlans, type GroupQuery } from '../../api/togetherData';
import { errorMessage, type ReadingGroup, type GroupPlan } from './contracts';

export interface GroupDraft {
  readonly name: string;
  readonly description: string;
  readonly plan_ids: readonly number[];
  readonly max_members: string;
  readonly is_public: boolean;
}
const emptyDraft = (): GroupDraft => ({ name: '', description: '', plan_ids: [], max_members: '20', is_public: true });

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error' | 'guest';
export interface TogetherState {
  readonly groups: readonly ReadingGroup[];
  readonly listStatus: LoadStatus;
  readonly listError: string;
  readonly selectedId: number | null;
  readonly detail: ReadingGroup | null;
  readonly detailStatus: LoadStatus;
  readonly detailError: string;
  readonly joining: boolean;
  readonly actionError: string;
  readonly createOpen: boolean;
  readonly draft: GroupDraft;
  readonly plans: readonly GroupPlan[];
  readonly plansStatus: LoadStatus;
  readonly plansError: string;
  readonly creating: boolean;
  readonly createError: string;
  readonly leaveConfirm: boolean;
  readonly leaving: boolean;
}

// Each instance belongs to one auth/API scope. Generations invalidate reads and
// mutation acknowledgements when a query, group, session, or stack changes.
export class TogetherModel {
  state: TogetherState = {
    groups: [], listStatus: 'idle', listError: '', selectedId: null,
    detail: null, detailStatus: 'idle', detailError: '', joining: false, actionError: '',
    createOpen: false, draft: emptyDraft(), plans: [], plansStatus: 'idle', plansError: '',
    creating: false, createError: '', leaveConfirm: false, leaving: false,
  };
  private listGeneration = 0;
  private detailGeneration = 0;
  private createGeneration = 0;
  private alive = true;
  private query: GroupQuery | null = null;
  private listeners = new Set<() => void>();
  constructor(private readonly apiFetch: ApiFetch, readonly signedIn: boolean) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.state;
  private update(patch: Partial<TogetherState>) {
    if (!this.alive) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  async loadList(query: GroupQuery) {
    const generation = ++this.listGeneration;
    this.query = query;
    this.update({ groups: [], listStatus: query.filter === 'mine' && !this.signedIn ? 'guest' : 'loading', listError: '' });
    if (query.filter === 'mine' && !this.signedIn) return;
    try {
      const groups = await fetchGroups(this.apiFetch, query);
      if (generation === this.listGeneration) this.update({ groups, listStatus: 'ready' });
    } catch (error) {
      if (generation === this.listGeneration) this.update({ listStatus: 'error', listError: errorMessage(error) });
    }
  }
  async openGroup(id: number) {
    this.createGeneration++;
    this.update({ createOpen: false, creating: false });
    const generation = ++this.detailGeneration;
    this.update({ selectedId: id, detail: null, detailStatus: 'loading', detailError: '', actionError: '', joining: false, leaveConfirm: false, leaving: false });
    try {
      const detail = await fetchGroup(this.apiFetch, id);
      if (generation === this.detailGeneration) this.update({ detail, detailStatus: 'ready' });
    } catch (error) {
      if (generation === this.detailGeneration) this.update({ detailStatus: 'error', detailError: errorMessage(error) });
    }
  }
  closeGroup() {
    this.detailGeneration++;
    this.update({ selectedId: null, detail: null, detailStatus: 'idle', joining: false, actionError: '', leaveConfirm: false, leaving: false });
  }
  async openCreate() {
    if (!this.alive || !this.signedIn || this.state.createOpen) return;
    this.update({ createOpen: true, draft: emptyDraft(), createError: '' });
    await this.loadCreationPlans();
  }
  async loadCreationPlans() {
    if (!this.alive || !this.state.createOpen) return;
    const generation = ++this.createGeneration;
    this.update({ plansStatus: 'loading', plansError: '' });
    try {
      const plans = await fetchCreationPlans(this.apiFetch);
      if (generation === this.createGeneration) this.update({ plans, plansStatus: 'ready' });
    } catch (error) {
      if (generation === this.createGeneration) this.update({ plansStatus: 'error', plansError: errorMessage(error) });
    }
  }
  closeCreate() {
    if (this.state.creating) return;
    this.createGeneration++;
    this.update({ createOpen: false });
  }
  editDraft(patch: Partial<GroupDraft>) {
    if (!this.state.creating) this.update({ draft: { ...this.state.draft, ...patch }, createError: '' });
  }
  async create() {
    if (!this.alive || !this.signedIn || !this.state.createOpen || this.state.creating) return;
    const draft = this.state.draft;
    const max = Number(draft.max_members);
    if (!draft.name.trim() || draft.name.length > 100 || draft.description.length > 500
      || !Number.isInteger(max) || max < 2 || max > 100 || !draft.plan_ids.length
      || this.state.plansStatus !== 'ready' || draft.plan_ids.some((id) => !this.state.plans.some((plan) => plan.id === id))) {
      this.update({ createError: '이름은 100자, 설명은 500자 이내로 입력하고 플랜과 인원(2~100명)을 확인해 주세요.' });
      return;
    }
    const generation = this.createGeneration;
    this.update({ creating: true, createError: '' });
    try {
      const detail = await createGroup(this.apiFetch, { ...draft, max_members: max });
      if (!this.alive || generation !== this.createGeneration) return;
      this.detailGeneration++;
      this.update({ createOpen: false, selectedId: detail.id, detail, detailStatus: 'ready', detailError: '', actionError: '' });
      if (this.query) await this.loadList(this.query);
    } catch (error) {
      if (generation === this.createGeneration) this.update({ createError: errorMessage(error) });
    } finally {
      if (generation === this.createGeneration) this.update({ creating: false });
    }
  }
  requestLeave() {
    const group = this.state.detail;
    if (this.alive && this.signedIn && group?.is_member && group.my_role !== '관리자' && !this.state.leaving) {
      this.update({ leaveConfirm: true, actionError: '' });
    }
  }
  cancelLeave() {
    if (!this.state.leaving) this.update({ leaveConfirm: false, actionError: '' });
  }
  async leave() {
    const group = this.state.detail;
    if (!this.alive || !this.signedIn || !group?.is_member || group.my_role === '관리자'
      || !this.state.leaveConfirm || this.state.leaving) return;
    const generation = this.detailGeneration;
    this.update({ leaving: true, actionError: '' });
    try {
      await leaveGroup(this.apiFetch, group.id);
      if (!this.alive || generation !== this.detailGeneration) return;
      this.closeGroup();
      if (this.query) await this.loadList(this.query);
    } catch (error) {
      if (generation === this.detailGeneration) this.update({ actionError: errorMessage(error) });
    } finally {
      if (generation === this.detailGeneration) this.update({ leaving: false });
    }
  }
  async join() {
    const group = this.state.detail;
    if (!this.alive || !this.signedIn || !group || group.is_full || group.is_member || this.state.joining) return;
    const generation = this.detailGeneration;
    this.update({ joining: true, actionError: '' });
    try {
      await joinGroup(this.apiFetch, group.id);
      if (!this.alive || generation !== this.detailGeneration) return;
      // Server owns membership/counts, including concurrent joins and limits.
      const detail = await fetchGroup(this.apiFetch, group.id);
      if (generation !== this.detailGeneration) return;
      this.update({ detail });
      if (this.query) await this.loadList(this.query);
    } catch (error) {
      if (generation === this.detailGeneration) this.update({ actionError: errorMessage(error) });
    } finally {
      if (generation === this.detailGeneration) this.update({ joining: false });
    }
  }
  activate() { this.alive = true; }
  dispose() {
    this.alive = false;
    this.listGeneration++;
    this.detailGeneration++;
    this.createGeneration++;
  }
}
