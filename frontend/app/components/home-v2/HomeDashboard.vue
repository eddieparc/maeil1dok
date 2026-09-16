<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { FlameIcon, CalendarCheckIcon, BookOpenIcon, CheckIcon } from '@lucide/vue';
import { useLandingAuthState } from '~/composables/useLandingAuthState';
import { usePlanApi } from '~/composables/usePlanApi';
import { useApi } from '~/composables/useApi';
import { useScheduleFormatter } from '~/composables/useScheduleFormatter';
import type { components } from '~/types/generated/api-schema';
import HomeHero from '~/components/home-v2/HomeHero.vue';
import ReadingCardStack from '~/components/home-v2/ReadingCardStack.vue';
import HomeAsideCards from '~/components/home-v2/HomeAsideCards.vue';
import StatValue from '~/components/ui/StatValue.vue';
import Skeleton from '~/components/ui/Skeleton.vue';
import AppButton from '~/components/ui/AppButton.vue';

type CalendarEntry = components['schemas']['ProfileCalendarEntry'];
const { auth } = useLandingAuthState();
const api = useApi();
const planApi = usePlanApi();
const loading = ref(true);
const error = ref('');
const streak = ref<number | null>(null);
const progress = ref(0);
const remainingDays = ref<number | null>(null);
const planName = ref('');
const calendar = ref<CalendarEntry[]>([]);
const planId = ref<number | null>(null);
const retry = ref(0);

interface PlanCard {
  subscriptionId: number;
  planId: number;
  planName: string;
  progress: number;
  passage: string;
  assignmentRoute: { path: string; query: Record<string, string> } | null;
  description: string;
  remainingDays: number | null;
}
const planCards = ref<PlanCard[]>([]);
const availablePlans = ref<{ id: number; name: string; is_default: boolean }[]>([]);
const subscribing = ref(false);
const today = useState('home:today', () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
});
const weekDates = computed(() => {
  const monday = new Date(`${today.value}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), label: ['월', '화', '수', '목', '금', '토', '일'][index], number: date.getUTCDate() };
  });
});
const planCalendar = computed(() => calendar.value.filter(entry => entry.plan_id === planId.value));
const week = computed(() => weekDates.value.map(day => {
  const entries = planCalendar.value.filter(entry => entry.date === day.date);
  const read = entries.length > 0 && entries.every(entry => entry.is_completed);
  const isToday = day.date === today.value;
  const state = read ? 'read' : isToday ? 'today' : day.date > today.value ? 'upcoming' : 'missed';
  const status = { read: '읽음', today: '오늘', upcoming: '예정', missed: '읽지 않음' }[state];
  return { ...day, isToday, state, status };
}));
const weeklyCompleted = computed(() => week.value.filter(day => day.state === 'read').length);
const recentRecords = computed(() => planCalendar.value
  .filter(entry => entry.is_completed && entry.date <= today.value)
  .toSorted((a, b) => b.date.localeCompare(a.date) || b.schedule_id - a.schedule_id)
  .slice(0, 3));
const todayEntries = computed(() => planCalendar.value.filter(entry => entry.date === today.value));
const { getBookCode } = useScheduleFormatter();
function bookUnit(entry: CalendarEntry & { readonly book_unit_kor?: string }): string {
  return entry.book_unit_kor || (entry.book === '시편' ? '편' : '장');
}
function formatPassage(entry: CalendarEntry & { readonly book_unit_kor?: string }): string {
  const unit = bookUnit(entry);
  const range = entry.start_chapter === entry.end_chapter ? entry.start_chapter : `${entry.start_chapter}-${entry.end_chapter}`;
  return `${entry.book} ${range}${unit}`;
}
const assignment = computed(() => todayEntries.value[0] ?? null);
const passage = computed(() => assignment.value ? formatPassage(assignment.value) : '');
const assignmentRoute = computed(() => {
  const entry = assignment.value;
  const book = entry && getBookCode(entry.book);
  if (!entry || !book || error.value) return null;
  return { path: '/bible', query: { book, chapter: String(entry.start_chapter), schedule: String(entry.schedule_id), plan: String(entry.plan_id), date: entry.date, tongdok: 'true' } };
});
const description = computed(() => {
  if (error.value) return '기록을 불러오지 못했습니다. 다시 시도해주세요.';
  if (!planId.value) return '통독표에서 읽기 플랜을 선택해보세요';
  if (!assignment.value) return '오늘 예정된 본문이 없어요. 통독표를 확인해보세요';
  const chapters = assignment.value.end_chapter - assignment.value.start_chapter + 1;
  return `총 ${chapters}${bookUnit(assignment.value)} · 오늘의 통독`;
});

const hasNoPlan = computed(() => !loading.value && !error.value && planCards.value.length === 0);
const defaultPlan = computed(() => availablePlans.value.find(p => p.is_default) ?? availablePlans.value[0] ?? null);

async function subscribeToDefault() {
  if (!defaultPlan.value || subscribing.value) return;
  subscribing.value = true;
  const ok = await planApi.subscribeToPlan(defaultPlan.value.id);
  subscribing.value = false;
  if (ok) retry.value++;
}

onMounted(() => {
  watch([() => auth.isAuthenticated.value ? auth.user.value?.id : null, retry], async ([userId], _, onCleanup) => {
    let active = true;
    onCleanup(() => { active = false; });
    loading.value = true;
    error.value = '';
    streak.value = null;
    progress.value = 0;
    remainingDays.value = null;
    planName.value = '';
    planId.value = null;
    calendar.value = [];
    if (!userId) return;

    try {
      const months = [...new Set(weekDates.value.map(day => day.date.slice(0, 7)))];
      const [plans, profileResponse, calendarResponses] = await Promise.all([
        planApi.fetchUserPlans(),
        api.GET(api.path('/api/v1/auth/profile/{user_id}/', { user_id: userId })),
        Promise.all(months.map(month => api.GET(api.path('/api/v1/auth/profile/{user_id}/calendar/', { user_id: userId }), {
          params: { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) },
        }))),
      ]);
      if (!active) return;
      if (!plans || !profileResponse.data.success || calendarResponses.some(response => !response.data.success)) {
        throw new Error('읽기 기록을 불러오지 못했습니다.');
      }
      streak.value = profileResponse.data.data.profile.current_streak;
      calendar.value = calendarResponses.flatMap(response => response.data.data.calendar);
      availablePlans.value = plans.available_plans;

      const activeSubs = plans.subscriptions.filter(s => s.is_active);
      if (!activeSubs.length) return;

      // Primary plan for stats (first active, preferring default)
      const primary = activeSubs.find(s => s.is_default) ?? activeSubs[0]!;
      planId.value = primary.plan_id;
      planName.value = primary.plan_name;

      // Fetch progress + schedules for up to 3 active plans
      const cardSubs = activeSubs.slice(0, 3);
      const cardResults = await Promise.all(cardSubs.map(async sub => {
        const [progressRes, schedulesRes] = await Promise.all([
          api.GET('/api/v1/todos/stats/progress/', { params: { plan_id: sub.plan_id } }),
          api.GET('/api/v1/todos/schedules/', { params: { plan_id: sub.plan_id } }),
        ]);
        return { sub, progressRes, schedulesRes };
      }));
      if (!active) return;

      planCards.value = cardResults.map(({ sub, progressRes, schedulesRes }) => {
        const planEntries = calendar.value.filter(e => e.plan_id === sub.plan_id);
        const todayEntry = planEntries.find(e => e.date === today.value);
        const prog = progressRes.data.success ? Math.round(progressRes.data.user_progress) : 0;
        const finalDate = schedulesRes.data.map(s => s.date).sort().at(-1);
        const remaining = finalDate ? Math.max(0, Math.ceil((Date.parse(`${finalDate}T00:00:00Z`) - Date.parse(`${today.value}T00:00:00Z`)) / 86400000)) : null;
        const book = todayEntry && getBookCode(todayEntry.book);
        const route = todayEntry && book ? { path: '/bible', query: { book, chapter: String(todayEntry.start_chapter), schedule: String(todayEntry.schedule_id), plan: String(todayEntry.plan_id), date: todayEntry.date, tongdok: 'true' } } : null;
        const chapters = todayEntry ? todayEntry.end_chapter - todayEntry.start_chapter + 1 : 0;
        const desc = todayEntry ? `총 ${chapters}${bookUnit(todayEntry)} · 오늘의 통독` : '오늘 예정된 본문이 없어요';
        return { subscriptionId: sub.id, planId: sub.plan_id, planName: sub.plan_name, progress: prog, passage: todayEntry ? formatPassage(todayEntry) : '', assignmentRoute: route, description: desc, remainingDays: remaining };
      });

      // Stats use the primary plan
      const primaryCard = planCards.value.find(c => c.planId === primary.plan_id);
      progress.value = primaryCard?.progress ?? 0;
      remainingDays.value = primaryCard?.remainingDays ?? null;
    } catch (cause) {
      if (active) error.value = cause instanceof Error ? cause.message : '읽기 기록을 불러오지 못했습니다.';
    } finally {
      if (active) loading.value = false;
    }
  }, { immediate: true });
});
</script>

<template>
  <div class="home-dashboard stagger">
    <div class="dashboard-main">
    <HomeHero :streak="streak" />
    <template v-if="planCards.length">
      <ReadingCardStack v-for="card in planCards" :key="card.subscriptionId" :progress="card.progress" :plan-name="card.planName" :passage="card.passage" :assignment-route="card.assignmentRoute" :description="card.description" :loading="loading">
        <template v-if="$slots.progress" #progress="ring">
          <slot name="progress" v-bind="ring" />
        </template>
      </ReadingCardStack>
    </template>
    <section v-else-if="hasNoPlan" class="plan-suggestion" aria-label="통독 플랜 제안">
      <p class="suggestion-text">아직 통독 플랜이 없어요</p>
      <p v-if="defaultPlan" class="suggestion-plan">{{ defaultPlan.name }}</p>
      <AppButton v-if="defaultPlan" variant="secondary" size="sm" :disabled="subscribing" @click="subscribeToDefault">
        {{ subscribing ? '시작하는 중…' : '이 플랜으로 시작하기' }}
      </AppButton>
      <AppButton v-else variant="secondary" size="sm" @click="navigateTo('/plan')">통독표 보기</AppButton>
    </section>
    <div v-if="error" class="load-error" role="alert">
      <p>{{ error }}</p>
      <AppButton variant="secondary" size="sm" @click="retry++">다시 시도</AppButton>
    </div>
    <section class="stats-grid" aria-label="나의 통독 기록" :aria-busy="loading">
      <div class="stat-card">
        <p class="stat-heading"><FlameIcon class="streak-icon" :size="16" aria-hidden="true" />연속</p>
        <Skeleton v-if="loading" width="64px" height="24px" />
        <StatValue v-else :value="streak ?? '-'" unit="일" />
      </div>
      <div class="stat-card weekly-stat">
        <p class="stat-heading"><CalendarCheckIcon :size="16" aria-hidden="true" />이번 주</p>
        <Skeleton v-if="loading" width="64px" height="24px" />
        <StatValue v-else :value="error ? '-' : weeklyCompleted" unit="/7" />
      </div>
      <div class="stat-card">
        <p class="stat-heading"><BookOpenIcon :size="16" aria-hidden="true" />완독까지</p>
        <Skeleton v-if="loading" width="64px" height="24px" />
        <StatValue v-else :value="remainingDays ?? '-'" unit="일" />
      </div>
    </section>
    <section class="recent-card" aria-labelledby="recent-records-title" :aria-busy="loading">
      <h2 id="recent-records-title" class="section-heading">최근 기록</h2>
      <Skeleton v-if="loading" width="100%" height="44px" />
      <p v-else-if="error" class="record-message">기록을 불러오지 못했습니다.</p>
      <ul v-else-if="recentRecords.length" class="recent-records">
        <li v-for="record in recentRecords" :key="record.schedule_id">
          <NuxtLink to="/plan" class="record-link">
            <CheckIcon :size="16" aria-hidden="true" />
            <span>{{ formatPassage(record) }}</span>
            <time :datetime="record.date">{{ record.date.slice(5).replace('-', '.') }}</time>
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="record-message">최근 완료한 통독 기록이 없어요.</p>
    </section>
    </div>
    <aside class="dashboard-aside" aria-label="읽기 소식">
    <section class="week-card" aria-label="이번 주 읽기 현황" :aria-busy="loading">
      <h2 class="section-heading">이번 주</h2>
      <ol class="week-grid">
        <li v-for="day in week" :key="day.date" class="week-day" :class="{ 'is-today': day.isToday }" :aria-label="`${day.date} ${loading ? '확인 중' : error ? '확인할 수 없음' : day.status}`" :aria-current="day.isToday ? 'date' : undefined">
          <span class="weekday-label">{{ day.label }}</span>
          <Skeleton v-if="loading" :circle="true" width="28px" height="28px" />
          <span v-else class="week-dot" :class="error ? 'week-dot-upcoming' : `week-dot-${day.state}`" aria-hidden="true">
            <CheckIcon v-if="day.state === 'read' && !error" :size="14" :stroke-width="3" />
            <template v-else>{{ day.number }}</template>
          </span>
        </li>
      </ol>
    </section>
    <HomeAsideCards :user-id="auth.isAuthenticated.value ? auth.user.value?.id : undefined" :today="today" />
    </aside>
  </div>
</template>

<style scoped>
.home-dashboard, .dashboard-main, .dashboard-aside { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.stat-card, .week-card, .recent-card { background: var(--color-bg-card); border: 1px solid var(--color-border-default); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.stat-card { padding: 14px 14px 12px; }
.stat-heading { display: flex; align-items: center; gap: 5px; margin: 0 0 12px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; line-height: 1.4; white-space: nowrap; }
.stat-heading svg { flex-shrink: 0; }
.streak-icon { color: var(--color-accent-primary); }
.weekly-stat :deep(.stat-value__unit) { color: var(--color-text-tertiary); }
.week-card { padding: 14px 16px; }
.recent-card { padding: 18px 20px; }
.section-heading { margin: 0 0 14px; color: var(--color-text-primary); font-size: 15px; font-weight: 700; }
.recent-records { margin: 0; padding: 0; list-style: none; }
.recent-records li + li { border-top: 1px solid var(--color-border-default); }
.record-link { display: flex; align-items: center; gap: 10px; min-height: var(--hit-min); color: var(--color-text-primary); font-size: 14px; text-decoration: none; border-radius: var(--radius-control); transition: background var(--duration-micro) ease, transform var(--duration-micro) ease; }
.record-link svg { flex-shrink: 0; color: var(--color-accent-primary); }
.record-link time { margin-left: auto; flex-shrink: 0; color: var(--color-text-tertiary); font-size: 12px; }
.record-link:hover { background: var(--color-bg-hover); }
.record-link:active { transform: scale(.97); }
.record-link:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 1px var(--color-accent-primary); }
.record-message { margin: 0; color: var(--color-text-secondary); font-size: 13px; }
@media (min-width: 1024px) {
  .stats-grid :deep(.stat-value__number) { font-size: 28px; }
  .stat-heading { flex-wrap: wrap; white-space: normal; }
}
.week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin: 0; padding: 0; list-style: none; }
.week-day { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.weekday-label { color: var(--color-text-tertiary); font-size: 11px; font-weight: 600; line-height: 1; }
.is-today .weekday-label { color: var(--color-accent-primary); }
.week-dot { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.week-dot-read { background: var(--color-accent-primary); color: var(--color-text-inverse); }
.week-dot-today { background: var(--color-accent-primary-light); border: 1.5px solid var(--color-accent-primary); color: var(--color-accent-primary); }
.week-dot-upcoming { background: var(--color-bg-card); border: 1.5px dashed var(--color-border-default); color: var(--color-text-tertiary); }
.week-dot-missed { background: var(--color-bg-card); border: 1.5px solid var(--color-border-default); color: var(--color-text-tertiary); }
.load-error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; color: var(--color-error); font-size: 13px; }
.load-error p { margin: 0; }
.plan-suggestion { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 20px; background: var(--color-bg-card); border: 1px solid var(--color-border-default); border-radius: var(--radius-card); box-shadow: var(--shadow-card); text-align: center; }
.suggestion-text { margin: 0; color: var(--color-text-primary); font-size: 15px; font-weight: 600; }
.suggestion-plan { margin: 0; color: var(--color-text-secondary); font-size: 13px; }
/* H01 reserves recent records and supplementary news for the desktop columns. */
@media (max-width: 1023px) {
  .recent-card,
  .dashboard-aside :deep(.aside-card),
  .dashboard-aside :deep(.app-button) { display: none; }
}
@media (max-width: 359px) {
  .stat-card { padding-inline: 10px; }
  .stat-heading { gap: 3px; }
}
@media (prefers-reduced-motion: reduce) {
  .home-dashboard, .home-dashboard > * { animation: none; }
  .record-link { transition: none; }
  .record-link:active { transform: none; }
}
</style>
