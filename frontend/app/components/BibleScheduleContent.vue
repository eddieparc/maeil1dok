<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowUp, CalendarDays, ChevronDown } from '@lucide/vue';
import { useAuthService } from '~/composables/useAuthService';
import { useAuthGuard } from '~/composables/useAuthGuard';
import { useSelectedPlanStore } from '~/stores/selectedPlan';
import { usePlanApi } from '~/composables/usePlanApi';
import { useScheduleApi } from '~/composables/useScheduleApi';
import { useModal } from '~/composables/useModal';
import { useToast } from '~/composables/useToast';
import { useScrollToElement } from '~/composables/useScrollToElement';
import { getBookCode, getBookOrder } from '~/constants/bible';
import { getTodayString } from '~/utils/dateFormat';
import { DEFAULT_BULK_EDIT_STATE } from '~/types/plan';
import type { BulkEditState, GroupedSchedules, RangeSelectPayload, ReadingAction, Schedule, ScrollTarget, SubscriptionSummary } from '~/types/plan';
import AppButton from '~/components/ui/AppButton.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';
import MonthSelector from '~/components/schedule/MonthSelector.vue';
import QuickNavigation from '~/components/schedule/QuickNavigation.vue';
import BulkEditIndicator from '~/components/schedule/BulkEditIndicator.vue';
import ScheduleItem from '~/components/schedule/ScheduleItem.vue';
import PlanSelectorModal from '~/components/schedule/PlanSelectorModal.vue';

const props = defineProps<{
  isModal?: boolean;
  currentBook?: string;
  currentChapter?: number;
  useDefaultPlan?: boolean;
  isBulkEditMode?: boolean;
  useNewBibleRoute?: boolean;
  initialScrollTarget?: 'today' | 'lastIncomplete' | 'currentLocation';
}>();
const emit = defineEmits<{
  'schedule-select': [schedule: Schedule];
  'range-select': [payload: RangeSelectPayload];
}>();
const auth = useAuthService();
const { requireAuthWithPrompt } = useAuthGuard();
const planStore = useSelectedPlanStore();
const planApi = usePlanApi();
const scheduleApi = useScheduleApi();
const modal = useModal();
const toast = useToast();
const router = useRouter();
const route = useRoute();
const { scrollToElement, setScrollContainer } = useScrollToElement();
const mounted = ref(false);
const initialized = ref(false);
const loading = ref(true);
const loadError = ref('');
const saving = ref(false);
const navigating = ref(false);
const showPlanModal = ref(false);
const showScrollTop = ref(false);
const scheduleBodyRef = ref<HTMLElement | null>(null);
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);
const subscriptions = ref<SubscriptionSummary[]>([]);
const schedules = ref<Schedule[]>([]);
const bulkEditState = ref<BulkEditState>({ ...DEFAULT_BULK_EDIT_STATE });
// This instance's cache is cleared synchronously on every auth identity change.
// The selected plan's whole year is prefetched so month dots render without a click.
const monthCache = reactive(new Map<string, Schedule[]>());
const inFlight = new Map<string, Promise<Schedule[]>>();
let epoch = 0;
let navigationId = 0;
const identity = computed(() => auth.isInitialized.value && !auth.isSessionUnknown.value
  ? `${auth.isAuthenticated.value ? 'user' : 'guest'}:${auth.user.value?.id ?? ''}` : null);
const selectedPlanId = computed(() => planStore.selectedPlanId);
const selectedPlanName = computed(() => subscriptions.value.find(sub => sub.plan_id === selectedPlanId.value)?.plan_name ?? '플랜 선택');
const defaultPlanName = computed(() => subscriptions.value.find(sub => sub.is_default)?.plan_name ?? selectedPlanName.value);
const monthKey = (planId: number, year: number, month: number) => `${planId}:${year}:${month}`;
const currentKey = computed(() => selectedPlanId.value === null ? '' : monthKey(selectedPlanId.value, selectedYear.value, selectedMonth.value));
const groupedSchedules = computed(() => {
  const grouped: GroupedSchedules = {};
  for (const schedule of [...schedules.value].sort((a, b) => a.date.localeCompare(b.date) || getBookOrder(a.book) - getBookOrder(b.book) || a.id - b.id)) {
    (grouped[schedule.date] ??= []).push(schedule);
  }
  return grouped;
});
const totalDays = computed(() => Object.keys(groupedSchedules.value).length);
const completedDays = computed(() => Object.values(groupedSchedules.value).filter(group => group.every(schedule => schedule.is_completed)).length);
const percent = computed(() => totalDays.value ? Math.round(completedDays.value / totalDays.value * 100) : 0);
const cachedMonthProgress = computed(() => {
  const result: Record<number, { done: number; total: number }> = {};
  if (selectedPlanId.value === null) return result;
  for (let month = 1; month <= 12; month++) {
    const cached = monthCache.get(monthKey(selectedPlanId.value, selectedYear.value, month));
    if (cached) result[month] = { done: cached.filter(schedule => schedule.is_completed).length, total: cached.length };
  }
  return result;
});
const rangeDates = computed<[string, string] | null>(() => {
  const { firstSchedule, secondSchedule } = bulkEditState.value;
  if (!firstSchedule) return null;
  const first = firstSchedule.date;
  const second = (secondSchedule ?? firstSchedule).date;
  return first <= second ? [first, second] : [second, first];
});
const selectedSchedules = computed(() => schedules.value.filter(schedule => inRange(schedule.date)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id));
function inRange(date: string): boolean {
  const range = rangeDates.value;
  return props.isBulkEditMode === true && range !== null && date >= range[0] && date <= range[1];
}
function resetBulk() { bulkEditState.value = { ...DEFAULT_BULK_EDIT_STATE }; }

async function fetchSchedules(): Promise<boolean> {
  const planId = selectedPlanId.value;
  if (planId === null) { loading.value = false; schedules.value = []; return false; }
  const requestEpoch = epoch;
  const key = currentKey.value;
  const live = () => mounted.value && epoch === requestEpoch && currentKey.value === key;
  loadError.value = '';
  const cached = monthCache.get(key);
  if (cached) { schedules.value = cached; loading.value = false; return true; }
  loading.value = true;
  schedules.value = [];
  let request = inFlight.get(key);
  if (!request) {
    request = scheduleApi.fetchMonthlySchedules(planId, selectedMonth.value, selectedYear.value, { throwOnError: true });
    inFlight.set(key, request);
  }
  try {
    const data = await request;
    if (epoch !== requestEpoch || !mounted.value) return false;
    monthCache.set(key, data);
    if (live()) schedules.value = monthCache.get(key)!;
    return live();
  } catch {
    if (live()) loadError.value = '일정을 불러오지 못했어요. 다시 시도해주세요.';
    return false;
  } finally {
    if (inFlight.get(key) === request) inFlight.delete(key);
    if (live()) loading.value = false;
  }
}

async function initialize() {
  const requestEpoch = ++epoch;
  navigationId++;
  initialized.value = false;
  loading.value = true;
  saving.value = false;
  navigating.value = false;
  showPlanModal.value = false;
  loadError.value = '';
  schedules.value = [];
  subscriptions.value = [];
  monthCache.clear();
  inFlight.clear();
  resetBulk();
  if (!mounted.value || !identity.value) {
    if (mounted.value && auth.isSessionUnknown.value) {
      loading.value = false;
      loadError.value = '로그인 상태를 확인하지 못했어요. 연결을 확인하고 다시 시도해주세요.';
    }
    return;
  }
  try {
    // Strict reads distinguish failure from empty and do not reuse an older
    // identity's request. The epoch owns both success and error application.
    const data = await planApi.fetchSubscriptions({ throwOnError: true });
    if (epoch !== requestEpoch || !mounted.value) return;
    subscriptions.value = data;
    // Hydrate the persisted selection before reading it so the last chosen
    // plan loads on entry (initializeFromStorage otherwise runs after this).
    planStore.initializeFromStorage();
    const urlPlan = Number(route.query.plan);
    const remembered = planStore.selectedPlanId;
    const selected = data.find(sub => sub.plan_id === urlPlan)
      ?? (auth.isAuthenticated.value ? data.find(sub => sub.plan_id === remembered) : undefined)
      ?? ((props.useDefaultPlan || !auth.isAuthenticated.value) ? (data.find(sub => sub.is_default) ?? data[0]) : undefined);
    planStore.setSelectedPlanId(selected?.plan_id ?? null);
    await nextTick(); // Let selection watchers settle before enabling monthly loads.
    if (epoch !== requestEpoch) return;
    initialized.value = true;
    const loaded = await fetchSchedules();
    if (loaded && epoch === requestEpoch && selectedPlanId.value !== null && import.meta.client) schedulePrefetch(selectedPlanId.value);
    if (loaded && epoch === requestEpoch) {
      await handleScrollTo(props.initialScrollTarget ?? (props.isModal && props.currentBook && props.currentChapter ? 'currentLocation' : 'today'));
    }
  } catch {
    if (epoch === requestEpoch) { loadError.value = '플랜을 불러오지 못했어요. 다시 시도해주세요.'; loading.value = false; }
  }
}

async function retryLoad() {
  if (auth.isSessionUnknown.value) { await auth.revalidate(); return; }
  if (initialized.value) await fetchSchedules();
  else await initialize();
}
function selectMonth(month: number) {
  if (saving.value) return;
  navigationId++;
  navigating.value = false;
  selectedMonth.value = month;
}
function selectPlan(subscription: SubscriptionSummary) {
  if (saving.value) return;
  navigationId++;
  navigating.value = false;
  showPlanModal.value = false;
  planStore.setSelectedPlanId(subscription.plan_id);
  if (import.meta.client) schedulePrefetch(subscription.plan_id);
}

// Populate the month-dot cache for the whole year so dots appear without a
// month click. Deferred to idle so it never competes with the visible month's
// load; each month fills in as its request resolves and failures are ignored
// (the dot simply stays absent until the month is opened).
let prefetchTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePrefetch(planId: number) {
  if (prefetchTimer) clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(() => {
    prefetchTimer = null;
    prefetchYear(planId);
  }, 0);
}
function prefetchYear(planId: number) {
  const requestEpoch = epoch;
  for (let month = 1; month <= 12; month++) {
    const key = monthKey(planId, selectedYear.value, month);
    if (monthCache.has(key) || inFlight.has(key)) continue;
    const request = scheduleApi.fetchMonthlySchedules(planId, month, selectedYear.value, { throwOnError: true })
      .then(data => { if (epoch === requestEpoch && mounted.value) monthCache.set(key, data); return data; })
      .catch(() => [] as Schedule[])
      .finally(() => { if (inFlight.get(key) === request) inFlight.delete(key); });
    inFlight.set(key, request);
  }
}
function selectRange(schedule: Schedule) {
  if (saving.value) return;
  if (!bulkEditState.value.firstSchedule || bulkEditState.value.secondSchedule) {
    bulkEditState.value = { firstSchedule: schedule, secondSchedule: null, message: `${schedule.date}부터 · 두번째 일정을 선택해주세요`, showActions: false };
  } else {
    bulkEditState.value.secondSchedule = schedule;
    bulkEditState.value.showActions = true;
    bulkEditState.value.message = `${rangeDates.value?.join(' ~ ')} · ${selectedSchedules.value.length}개 일정을`;
  }
}
async function updateSchedules(items: Schedule[], action: ReadingAction): Promise<boolean> {
  if (saving.value || selectedPlanId.value === null) return false;
  const requestEpoch = epoch;
  const planId = selectedPlanId.value;
  const key = currentKey.value;
  if (!await requireAuthWithPrompt('읽음 표시를 기록하려면 로그인이 필요해요.')) return false;
  if (epoch !== requestEpoch || key !== currentKey.value || saving.value) return false;
  saving.value = true;
  const snapshot = items.map(schedule => [schedule, schedule.is_completed] as const);
  items.forEach(schedule => { schedule.is_completed = action === 'complete'; });
  try {
    const saved = await scheduleApi.updateReadingStatus(planId, items.map(schedule => schedule.id), action);
    if (epoch !== requestEpoch) return false;
    if (!saved) {
      snapshot.forEach(([schedule, completed]) => { schedule.is_completed = completed; });
      toast.error('저장하지 못했어요. 다시 시도해주세요.');
    }
    return saved && key === currentKey.value;
  } finally {
    if (epoch === requestEpoch) saving.value = false;
  }
}
async function handleCheckbox(items: Schedule[]) {
  const first = items[0];
  if (saving.value || !first) return;
  if (props.isBulkEditMode) { selectRange(first); return; }
  const action = items.every(schedule => schedule.is_completed) ? 'cancel' : 'complete';
  if (await updateSchedules(items, action)) toast.success(action === 'complete' ? '읽음으로 기록했어요.' : '읽음 표시를 해제했어요.');
}
async function handleBulkAction(action: ReadingAction) {
  const { firstSchedule, secondSchedule } = bulkEditState.value;
  if (!firstSchedule || !secondSchedule || saving.value) return;
  const items = selectedSchedules.value;
  const payload: RangeSelectPayload = { action, startSchedule: firstSchedule, endSchedule: secondSchedule, scheduleIds: items.map(schedule => schedule.id), planId: selectedPlanId.value };
  if (await updateSchedules(items, action)) {
    resetBulk();
    toast.success(`${items.length}개 일정을 ${action === 'complete' ? '읽음' : '읽지 않음'}으로 기록했어요.`);
    // A persisted-success notification, not a second write request to the page.
    emit('range-select', payload);
  }
}
function handleGroupClick(group: Schedule[]) {
  const first = group[0];
  if (first) void handleScheduleClick(first);
}
async function handleScheduleClick(schedule: Schedule) {
  if (saving.value) return;
  if (props.isBulkEditMode) { selectRange(schedule); return; }
  if (props.isModal) { emit('schedule-select', schedule); return; }
  const requestEpoch = epoch;
  const planId = selectedPlanId.value;
  const confirmed = await modal.confirm({
    title: '본문 페이지로 이동할까요?',
    description: `${schedule.date} · ${schedule.book} ${schedule.start_chapter}-${schedule.end_chapter}${schedule.book === '시편' ? '편' : '장'}\n\n읽음 표시는 왼쪽 체크 또는 ‘일괄수정’으로 바꿀 수 있어요.`,
    confirmText: '이동', cancelText: '취소',
  });
  if (!confirmed || epoch !== requestEpoch || planId !== selectedPlanId.value) return;
  await router.push({ path: '/bible', query: { ...route.query, plan: String(planId), tongdok: 'true', schedule: String(schedule.id), from: 'plan', book: getBookCode(schedule.book), chapter: String(schedule.start_chapter) } });
}
async function handleScrollTo(target: ScrollTarget) {
  if (saving.value || !selectedPlanId.value) return;
  const requestEpoch = epoch;
  const requestId = ++navigationId;
  const planId = selectedPlanId.value;
  const live = () => epoch === requestEpoch && requestId === navigationId && planId === selectedPlanId.value && mounted.value;
  navigating.value = true;
  try {
    let date = getTodayString();
    if (target === 'lastIncomplete') {
      const position = await scheduleApi.fetchNextPosition(planId);
      if (!live()) return;
      if (!position?.success || !position.date) { toast.info(position?.message ?? '이동할 일정이 없어요.'); return; }
      date = position.date;
      if (position.status === 'all_completed' && position.message) toast.success(position.message);
    } else if (target === 'currentLocation') {
      if (!props.currentBook || !props.currentChapter) return;
      const position = await scheduleApi.fetchCurrentPosition(planId, getBookCode(props.currentBook) ?? props.currentBook, props.currentChapter);
      if (!live()) return;
      if (!position?.plan_date) { toast.info('현재 위치의 일정이 없어요.'); return; }
      date = position.plan_date;
    }
    selectedYear.value = Number(date.slice(0, 4));
    selectedMonth.value = Number(date.slice(5, 7));
    if (!await fetchSchedules() || !live()) return;
    await nextTick();
    if (live()) scrollToElement(scheduleBodyRef.value?.querySelector<HTMLElement>(`[data-date="${date}"]`) ?? null);
  } finally {
    if (live()) navigating.value = false;
  }
}
function scrollToTop() { scheduleBodyRef.value?.scrollTo({ top: 0, behavior: 'smooth' }); }
function handleScroll(event: Event) { showScrollTop.value = (event.target as HTMLElement).scrollTop > 300; }

watch([mounted, identity], () => { void initialize(); }, { flush: 'sync' });
watch(currentKey, () => { resetBulk(); if (initialized.value) void fetchSchedules(); });
watch(() => props.isBulkEditMode, resetBulk);
watch(scheduleBodyRef, value => setScrollContainer(value));
onMounted(() => { planStore.initializeFromStorage(); mounted.value = true; });
onBeforeUnmount(() => { mounted.value = false; epoch++; navigationId++; });
</script>

<template>
  <div class="bible-schedule-wrapper" :class="{ 'modal-schedule': props.isModal }">
    <div class="fixed-controls">
      <div class="top-row">
        <button type="button" class="plan-select-button" :disabled="saving || !initialized" aria-haspopup="dialog" :aria-expanded="showPlanModal" @click="showPlanModal = true">
          <span>{{ selectedPlanName }}</span><ChevronDown :size="16" aria-hidden="true" />
        </button>
        <QuickNavigation :show-current-location="!!(props.isModal && props.currentBook && props.currentChapter)" :disabled="saving || !initialized || loading || navigating" @scroll-to="handleScrollTo" />
      </div>
      <MonthSelector :model-value="selectedMonth" :progress="cachedMonthProgress" :disabled="saving" @update:model-value="selectMonth" />
      <BulkEditIndicator :show="!!props.isBulkEditMode" :state="bulkEditState" :disabled="saving" @action="handleBulkAction" />
      <div v-if="initialized && !auth.isAuthenticated.value" class="default-plan-indicator">
        비로그인 상태에서는 <strong>{{ defaultPlanName }}</strong>이 기본으로 표시돼요. 읽음 표시는 로그인 후 기록됩니다.
      </div>
    </div>
    <div ref="scheduleBodyRef" class="schedule-body" :data-is-modal="props.isModal" @scroll="handleScroll">
      <SkeletonList v-if="loading" :count="7" variant="schedule" aria-label="일정 불러오는 중" />
      <div v-else-if="loadError" role="alert" class="schedule-error">
        <p>{{ loadError }}</p><AppButton variant="secondary" data-retry="schedules" @click="retryLoad">다시 시도</AppButton>
      </div>
      <div v-else-if="!selectedPlanId" class="no-plan-selected"><CalendarDays :size="28" aria-hidden="true" /><p>플랜을 선택해주세요</p><AppButton variant="secondary" @click="showPlanModal = true">플랜 선택</AppButton></div>
      <template v-else>
        <header class="month-summary">
          <div><h2>{{ selectedYear }}년 {{ selectedMonth }}월</h2><span>{{ completedDays }}/{{ totalDays }}일 완료 · {{ percent }}%</span></div>
          <progress :value="completedDays" :max="totalDays || 1" aria-label="이번 달 읽기 진도" />
        </header>
        <div v-if="!totalDays" class="no-schedules">{{ selectedMonth }}월에 등록된 일정이 없습니다.</div>
        <div v-else class="schedule-list" :aria-busy="saving">
          <ScheduleItem v-for="(group, date) in groupedSchedules" :key="date" :date="String(date)" :schedules="group"
            :current-book="props.currentBook" :current-chapter="props.currentChapter" :is-modal="props.isModal"
            :is-bulk-edit-mode="props.isBulkEditMode" :is-in-selected-range="inRange(String(date))" :disabled="saving"
            @group-click="handleGroupClick" @group-checkbox="handleCheckbox"
            @item-click="handleScheduleClick" @item-checkbox="handleCheckbox([$event])" />
        </div>
      </template>
    </div>
    <PlanSelectorModal :show="showPlanModal" :subscriptions="subscriptions" :selected-plan-id="selectedPlanId" @close="showPlanModal = false" @select="selectPlan" @manage="showPlanModal = false; router.push('/plans')" />
    <button v-if="showScrollTop" type="button" class="scroll-top-button" aria-label="맨 위로" @click="scrollToTop"><ArrowUp :size="20" aria-hidden="true" /></button>
  </div>
</template>

<style scoped>
.bible-schedule-wrapper { display: flex; flex-direction: column; position: relative; flex: 1; min-height: 0; height: 100%; color: var(--color-text-primary); }
.modal-schedule { height: min(70dvh, 680px); }
.fixed-controls { display: grid; gap: 10px; padding: 4px var(--screen-gutter) 0; }
.top-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.plan-select-button { display: inline-flex; align-items: center; gap: 6px; max-width: 60%; min-width: var(--hit-min); min-height: 32px; padding: 4px 12px; border: 1px solid var(--color-border-default); border-radius: var(--radius-control); background: var(--color-bg-card); color: var(--color-text-primary); font-size: 14px; font-weight: 600; }
.plan-select-button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.plan-select-button svg { flex-shrink: 0; }
.default-plan-indicator { padding: 12px; border: 1px solid var(--color-border-default); border-radius: 12px; background: var(--color-bg-card); color: var(--color-text-secondary); font-size: 12px; line-height: 1.5; }
.schedule-body { flex: 1; min-height: 0; overflow-y: auto; position: relative; padding: 12px var(--screen-gutter) 40px; overscroll-behavior: contain; }
.month-summary { margin-bottom: 14px; }
.month-summary > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.month-summary h2 { margin: 0; font-size: 15px; font-weight: 700; }
.month-summary span { color: var(--color-text-secondary); font-size: 12px; font-variant-numeric: tabular-nums; }
progress { display: block; width: 100%; height: 3px; margin-top: 10px; border: 0; border-radius: var(--radius-pill); appearance: none; background: var(--color-border-default); accent-color: var(--color-accent-primary); }
progress::-webkit-progress-bar { background: var(--color-border-default); border-radius: var(--radius-pill); }
progress::-webkit-progress-value { background: var(--color-accent-primary); border-radius: var(--radius-pill); }
progress::-moz-progress-bar { background: var(--color-accent-primary); }
.schedule-list { display: grid; gap: 14px; }
.no-plan-selected, .no-schedules, .schedule-error { display: grid; justify-items: center; gap: 12px; padding: 40px 12px; color: var(--color-text-secondary); text-align: center; font-size: 14px; }
.scroll-top-button { position: absolute; bottom: 20px; right: 20px; display: grid; place-items: center; width: var(--hit-min); height: var(--hit-min); border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-card); color: var(--color-accent-primary); box-shadow: var(--shadow-card); }
button { cursor: pointer; transition: background-color .15s, color .15s, transform .15s; }
button:hover:not(:disabled) { background: var(--color-accent-bg); }
button:active:not(:disabled) { transform: scale(.97); }
button:disabled { opacity: .5; cursor: not-allowed; }
@media (prefers-reduced-motion: reduce) { button { transition: none; } button:active:not(:disabled) { transform: none; } }
</style>
