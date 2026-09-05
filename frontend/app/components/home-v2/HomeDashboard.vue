<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { FlameIcon, CalendarCheckIcon, BookOpenIcon, CheckIcon } from '@lucide/vue';
import { useLandingAuthState } from '~/composables/useLandingAuthState';
import { usePlanApi } from '~/composables/usePlanApi';
import { useApi } from '~/composables/useApi';
import type { components } from '~/types/generated/api-schema';
import HomeHero from '~/components/home-v2/HomeHero.vue';
import ReadingCardStack from '~/components/home-v2/ReadingCardStack.vue';
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
const todayEntries = computed(() => planCalendar.value.filter(entry => entry.date === today.value));
const passage = computed(() => todayEntries.value.map(entry => `${entry.book} ${entry.start_chapter === entry.end_chapter ? entry.start_chapter : `${entry.start_chapter}-${entry.end_chapter}`}장`).join(' · '));
const description = computed(() => {
  if (error.value) return '기록을 불러오지 못했습니다. 다시 시도해주세요.';
  if (!planId.value) return '통독표에서 읽기 플랜을 선택해보세요';
  if (!todayEntries.value.length) return '오늘 예정된 본문이 없어요. 자유롭게 읽어보세요';
  const chapters = todayEntries.value.reduce((sum, entry) => sum + entry.end_chapter - entry.start_chapter + 1, 0);
  return `총 ${chapters}장 · 오늘의 통독`;
});

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
      const subscription = plans.subscriptions.find(plan => plan.is_active && plan.is_default)
        ?? plans.subscriptions.find(plan => plan.is_active);
      if (!subscription) return;
      planId.value = subscription.plan_id;
      planName.value = subscription.plan_name;
      const [progressResponse, schedulesResponse] = await Promise.all([
        api.GET('/api/v1/todos/stats/progress/', { params: { plan_id: subscription.plan_id } }),
        api.GET('/api/v1/todos/schedules/', { params: { plan_id: subscription.plan_id } }),
      ]);
      if (!active) return;
      if (!progressResponse.data.success) throw new Error('통독 진도를 불러오지 못했습니다.');
      progress.value = Math.round(progressResponse.data.user_progress);
      const finalDate = schedulesResponse.data.map(schedule => schedule.date).sort().at(-1);
      if (finalDate) {
        remainingDays.value = Math.max(0, Math.ceil((Date.parse(`${finalDate}T00:00:00Z`) - Date.parse(`${today.value}T00:00:00Z`)) / 86400000));
      }
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
    <HomeHero :streak="streak" />
    <ReadingCardStack :progress="progress" :plan-name="planName" :passage="passage" :description="description" :loading="loading" />
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
    <section class="week-card" aria-label="이번 주 읽기 현황" :aria-busy="loading">
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
  </div>
</template>

<style scoped>
.home-dashboard { display: flex; flex-direction: column; gap: 20px; }
.stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.stat-card, .week-card { background: var(--color-bg-card); border: 1px solid var(--color-border-default); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.stat-card { padding: 14px 14px 12px; }
.stat-heading { display: flex; align-items: center; gap: 5px; margin: 0 0 12px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; line-height: 1.4; white-space: nowrap; }
.stat-heading svg { flex-shrink: 0; }
.streak-icon { color: var(--color-accent-primary); }
.weekly-stat :deep(.stat-value__unit) { color: var(--color-text-tertiary); }
.week-card { padding: 14px 16px; }
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
@media (max-width: 359px) {
  .stat-card { padding-inline: 10px; }
  .stat-heading { gap: 3px; }
}
@media (prefers-reduced-motion: reduce) {
  .home-dashboard, .home-dashboard > * { animation: none; }
}
</style>
