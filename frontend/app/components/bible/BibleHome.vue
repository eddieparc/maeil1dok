<template>
  <div class="bible-home">
    <header class="home-header">
      <h1>성경</h1>
      <nav class="header-actions" aria-label="성경 도구">
        <AppButton data-action="search" class="icon-button" variant="ghost" to="/bible/search" aria-label="본문 검색">
          <Search :size="20" aria-hidden="true" />
        </AppButton>
        <AppButton data-action="settings" class="icon-button" variant="ghost" aria-label="읽기 설정" @click="showSettings = true">
          <SlidersHorizontal :size="20" aria-hidden="true" />
        </AppButton>
      </nav>
    </header>

    <div class="home-content" :aria-busy="isRefreshing">
      <div v-if="isLoading" class="loading-state" role="status" aria-label="성경 홈을 불러오는 중">
        <div aria-hidden="true">
          <SkeletonStats :count="3" :announce="false" />
          <SkeletonList :count="4" variant="schedule" />
        </div>
      </div>
      <template v-else>
        <ListCard v-if="hasError" class="error-card" role="alert">
          <div class="error-heading"><CircleAlert :size="20" aria-hidden="true" /><h2>일부 정보를 불러오지 못했어요</h2></div>
          <p v-if="errors.session">연결 상태를 확인한 뒤 다시 시도해주세요.</p>
          <p v-if="errors.stats">성경 활동과 최근 기록을 불러오지 못했어요.</p>
          <p v-if="errors.plan">구독 정보를 확인하지 못했어요.</p>
          <p v-if="errors.schedule" class="schedule-error">오늘의 통독 일정을 불러오지 못했어요.</p>
          <AppButton data-action="retry" variant="secondary" :loading="isRefreshing" @click="loadHome">다시 시도</AppButton>
        </ListCard>

        <section v-if="showWelcomeGuide" class="welcome-section">
          <ListCard class="welcome-card">
            <span class="welcome-icon"><BookOpen :size="28" aria-hidden="true" /></span>
            <h2>매일일독에 오신 것을 환영합니다</h2>
            <p>성경을 읽고, 묵상하고, 기록해보세요.</p>
            <div class="welcome-actions">
              <AppButton data-action="welcome-toc" block @click="emit('show-toc')"><List :size="18" aria-hidden="true" />성경 목차에서 시작하기</AppButton>
              <AppButton variant="secondary" block to="/plans"><Calendar :size="18" aria-hidden="true" />통독 플랜 구독하기</AppButton>
            </div>
          </ListCard>
        </section>

        <template v-else>
          <section v-if="schedules.length" class="today-tongdok-section">
            <ListCard class="today-card">
              <div class="today-card-header"><span class="today-badge">오늘의 통독</span><span class="today-date">{{ todayDate }}</span></div>
              <div class="schedule-heading"><h2 class="schedule-location">{{ scheduleLocation }}</h2><p v-if="plan" class="plan-name">{{ plan.name }}</p></div>
              <div class="today-progress">
                <div class="progress-track" role="progressbar" aria-label="오늘의 통독 진도" :aria-valuenow="completedCount" :aria-valuemax="schedules.length" :aria-valuemin="0">
                  <div class="progress-fill" :style="{ width: `${completedCount / schedules.length * 100}%` }" />
                </div>
                <span>{{ completedCount }}/{{ schedules.length }} 완료</span>
              </div>
              <AppButton data-action="tongdok" :data-state="tongdokState" class="today-start-btn" :variant="tongdokState === 'completed' ? 'secondary' : 'primary'" block :disabled="tongdokState === 'completed' || isRefreshing" @click="startTodayTongdok">
                <CircleCheck v-if="tongdokState === 'completed'" :size="18" aria-hidden="true" /><Play v-else :size="18" aria-hidden="true" />
                {{ tongdokState === 'completed' ? '오늘 통독 완료' : tongdokState === 'resume' ? '이어서 통독' : '통독 시작' }}
              </AppButton>
            </ListCard>
          </section>
          <ListCard v-else-if="planReady && plan && !errors.schedule" class="no-schedule">
            <div class="info-row"><Calendar :size="20" aria-hidden="true" /><div><h2>오늘은 예정된 통독이 없어요</h2><p class="plan-name">{{ plan.name }}</p></div></div>
            <AppButton variant="ghost" to="/plan">통독표 보기<ChevronRight :size="16" aria-hidden="true" /></AppButton>
          </ListCard>

          <div v-if="isAuthenticated && planReady && !plan" class="no-plan-hint">
            <Info :size="16" aria-hidden="true" /><p>플랜을 구독하면 매일 통독 일정을 받을 수 있어요</p><AppButton variant="ghost" size="sm" to="/plans">플랜 보기</AppButton>
          </div>

          <section v-if="lastPosition" class="continue-section">
            <h2 class="section-title">계속 읽기</h2>
            <button type="button" data-action="continue" class="continue-card" @click="emit('continue-reading')">
              <span class="row-icon continue-icon"><BookOpen :size="18" aria-hidden="true" /></span>
              <span class="row-content"><strong class="continue-location">{{ getBookName(lastPosition.book) }} {{ lastPosition.chapter }}{{ getChapterUnit(lastPosition.book) }}</strong><span v-if="lastVersionName" class="continue-meta">{{ lastVersionName }}</span></span>
              <ChevronRight :size="18" class="row-arrow" aria-hidden="true" />
            </button>
          </section>

          <section v-if="stats || (!isAuthenticated && !auth.isSessionUnknown.value)" class="features-section">
            <h2 class="section-title">내 성경 활동</h2>
            <ListCard :padded="false" class="grouped-card">
              <NuxtLink v-for="feature in features" :key="feature.key" :to="feature.to" class="feature-card list-card-row">
                <span class="row-icon"><component :is="feature.icon" :size="18" aria-hidden="true" /></span>
                <span class="row-content"><span class="feature-heading"><strong>{{ feature.name }}</strong><span v-if="feature.count" class="feature-count">{{ feature.count }}</span></span><span class="feature-desc">{{ feature.description }}</span></span>
                <ChevronRight :size="18" class="row-arrow" aria-hidden="true" />
              </NuxtLink>
            </ListCard>
          </section>

          <section v-if="showUsageTips" class="tips-section">
            <div class="section-heading"><h2 class="section-title">사용 팁</h2><AppButton data-action="dismiss-tips" class="dismiss-tips-btn" variant="ghost" size="sm" @click="dismissTips">다음부터 표시 안함</AppButton></div>
            <ListCard :padded="false" class="grouped-card">
              <div v-for="tip in usageTips" :key="tip.key" :data-tip="tip.key" class="tip-item list-card-row"><strong>{{ tip.title }}</strong><p>{{ tip.description }}</p></div>
            </ListCard>
            <p v-if="tipsStorageError" class="storage-error" role="alert">팁 숨김 설정을 저장하지 못했어요. 다음 방문에는 다시 표시될 수 있어요.</p>
          </section>
          <p v-else-if="tipsStorageError" class="storage-error" role="alert">팁 숨김 설정을 저장하지 못했어요. 다음 방문에는 다시 표시될 수 있어요.</p>

          <section v-if="recentRecords.length" class="recent-section">
            <h2 class="section-title">최근 읽은 성경</h2>
            <ListCard :padded="false" class="grouped-card">
              <button v-for="(record, index) in recentRecords" :key="`${record.book}-${record.chapter}-${index}`" type="button" class="recent-record list-card-row" @click="emit('select-book', record.book, record.chapter)">
                <span>{{ getBookName(record.book) }} {{ record.chapter }}{{ getChapterUnit(record.book) }}</span>
                <time v-if="record.read_date && formatDate(record.read_date)" :datetime="record.read_date">{{ formatDate(record.read_date) }}</time>
              </button>
            </ListCard>
          </section>
        </template>

        <AppButton data-action="toc" class="toc-btn" variant="secondary" block @click="emit('show-toc')"><List :size="18" aria-hidden="true" />성경 전체 목차</AppButton>
      </template>
    </div>
    <ReadingSettingsSheet v-model="showSettings" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NuxtLink } from '#components';
import { BookOpen, Bookmark, Calendar, ChevronRight, CircleAlert, CircleCheck, FileText, Highlighter, History, Info, List, Play, Search, SlidersHorizontal } from '@lucide/vue';
import AppButton from '~/components/ui/AppButton.vue';
import ListCard from '~/components/ui/ListCard.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';
import SkeletonStats from '~/components/ui/skeleton/SkeletonStats.vue';
import ReadingSettingsSheet from '~/components/ReadingSettingsSheet.vue';
import { useApi } from '~/composables/useApi';
import { useReadingPosition, type ReadingPosition } from '~/composables/useReadingPosition';
import { useBibleData, VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useAuthService } from '~/composables/useAuthService';
import { useSelectedPlanStore } from '~/stores/selectedPlan';
import { useSubscriptionStore } from '~/stores/subscription';
import type { components } from '~/types/generated/api-schema';

const emit = defineEmits<{
  'continue-reading': [];
  'select-book': [bookId: string, chapter: number];
  'show-toc': [];
}>();
const router = useRouter();
const api = useApi();
const auth = useAuthService();
const selectedPlanStore = useSelectedPlanStore();
const subscriptionStore = useSubscriptionStore();
const { loadReadingPosition } = useReadingPosition();
const { getBookName, getChapterUnit } = useBibleData();
const { handleSilentError } = useErrorHandler();
const lastPosition = ref<ReadingPosition | null>(null);
const stats = ref<components['schemas']['BibleHomeStatsResponse'] | null>(null);
const schedules = ref<components['schemas']['TodaySchedule'][]>([]);
const plan = ref<{ id: number; name: string } | null>(null);
const planReady = ref(false);
const errors = ref<Partial<Record<'session' | 'stats' | 'plan' | 'schedule', boolean>>>({});
const isLoading = ref(true);
const isRefreshing = ref(false);
const showSettings = ref(false);
const tipsDismissed = ref(false);
const tipsStorageError = ref(false);
let generation = 0;
let hasLoaded = false;
const isAuthenticated = computed(() => auth.isAuthenticated.value);
const hasError = computed(() => Object.values(errors.value).some(Boolean));
const recentRecords = computed(() => stats.value?.recent_records ?? []);
const lastVersionName = computed(() => lastPosition.value ? VISIBLE_VERSION_NAMES[lastPosition.value.version] : undefined);
const completedCount = computed(() => schedules.value.filter(schedule => schedule.is_completed).length);
const tongdokState = computed(() => completedCount.value === schedules.value.length ? 'completed' : completedCount.value ? 'resume' : 'start');
const todayDate = ref('');
const showWelcomeGuide = computed(() =>
  !isRefreshing.value && !hasError.value && !lastPosition.value && !schedules.value.length && !recentRecords.value.length
  && !stats.value?.bookmarks && !stats.value?.notes && !stats.value?.highlights
);
const features = computed(() => [
  { key: 'bookmarks', name: '북마크', icon: Bookmark, to: '/bible/bookmarks', count: stats.value?.bookmarks ?? 0, description: stats.value?.bookmarks ? `저장된 ${stats.value.bookmarks}개의 장` : '자주 찾는 장을 저장하세요' },
  { key: 'notes', name: '묵상노트', icon: FileText, to: '/bible/notes', count: stats.value?.notes ?? 0, description: stats.value?.notes ? `작성된 ${stats.value.notes}개의 노트` : '말씀을 읽고 묵상을 기록하세요' },
  { key: 'highlights', name: '하이라이트', icon: Highlighter, to: '/bible/highlights', count: stats.value?.highlights ?? 0, description: stats.value?.highlights ? `표시된 ${stats.value.highlights}개의 구절` : '중요한 구절에 색상을 입히세요' },
  { key: 'history', name: '읽기 기록', icon: History, to: '/bible/history', count: 0, description: '읽은 장과 날짜를 확인하세요' },
]);
const usageTips = computed(() => [
  { key: 'highlights', title: '하이라이트', description: '본문에서 절을 탭하면 하이라이트·복사·공유 메뉴가 나타나요', count: stats.value?.highlights ?? 0 },
  { key: 'bookmarks', title: '북마크', description: '읽기 화면 더보기 메뉴에서 북마크를 눌러 현재 장을 저장하세요', count: stats.value?.bookmarks ?? 0 },
  { key: 'notes', title: '묵상노트', description: '읽기 화면 더보기 메뉴에서 묵상노트를 작성할 수 있어요', count: stats.value?.notes ?? 0 },
].filter(tip => !tip.count));
const showUsageTips = computed(() => !tipsDismissed.value && !auth.isSessionUnknown.value && !errors.value.stats && features.value.reduce((total, feature) => total + feature.count, 0) < 3);
const scheduleLocation = computed(() => {
  const ranges: Array<{ book: string; start: number; end: number }> = [];
  for (const schedule of schedules.value) {
    const previous = ranges.at(-1);
    if (previous?.book === schedule.book_code && previous.end + 1 === schedule.start_chapter) previous.end = schedule.end_chapter;
    else ranges.push({ book: schedule.book_code, start: schedule.start_chapter, end: schedule.end_chapter });
  }
  return ranges.map(range => `${getBookName(range.book)} ${range.start}${range.end !== range.start ? `–${range.end}` : ''}${getChapterUnit(range.book)}`).join(' · ');
});

onMounted(() => {
  try {
    tipsDismissed.value = localStorage.getItem('bible_tips_dismissed') === 'true';
    selectedPlanStore.initializeFromStorage();
  } catch (error) {
    handleSilentError(error, '성경 홈 저장 설정 읽기');
  }
  void loadHome();
});
onBeforeUnmount(() => { generation++; });
watch(() => [selectedPlanStore.effectivePlanId, auth.user.value?.id, isAuthenticated.value], () => {
  if (hasLoaded) void loadHome();
});

async function loadHome() {
  const request = ++generation;
  const current = () => request === generation;
  isRefreshing.value = true;
  errors.value = {};
  todayDate.value = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  try {
    if (hasLoaded && auth.isSessionUnknown.value) await auth.revalidate();
    if (!current()) return;
    const position = await loadReadingPosition();
    if (!current()) return;
    lastPosition.value = position;
    if (auth.isSessionUnknown.value) {
      errors.value.session = true;
      return;
    }
    if (!isAuthenticated.value) {
      stats.value = null;
      schedules.value = [];
      plan.value = null;
      planReady.value = false;
      return;
    }
    await Promise.all([loadStats(request), loadPlan(request)]);
  } catch (error) {
    if (current()) { errors.value.session = true; handleSilentError(error, '성경 홈 로드'); }
  } finally {
    if (current()) { isLoading.value = false; isRefreshing.value = false; hasLoaded = true; }
  }
}

async function loadStats(request: number) {
  try {
    const { data } = await api.GET('/api/v1/todos/bible/home-stats/');
    if (request === generation) stats.value = data;
  } catch (error) {
    if (request === generation) { errors.value.stats = true; handleSilentError(error, '성경 활동 로드'); }
  }
}

async function loadPlan(request: number) {
  planReady.value = false;
  await subscriptionStore.fetchSubscriptions();
  if (request !== generation) return;
  if (subscriptionStore.error) {
    errors.value.plan = true;
    schedules.value = [];
    return;
  }
  const active = subscriptionStore.activeSubscriptions;
  const subscription = active.find(sub => sub.plan_id === selectedPlanStore.effectivePlanId)
    ?? active.find(sub => sub.is_default) ?? active[0];
  plan.value = subscription ? { id: subscription.plan_id, name: subscription.plan_name } : null;
  planReady.value = true;
  if (!subscription) { schedules.value = []; return; }
  try {
    const { data } = await api.GET('/api/v1/todos/schedules/today/', { params: { plan_id: subscription.plan_id } });
    if (!data.success) throw new Error('Today schedules request was unsuccessful');
    if (request === generation) schedules.value = data.schedules;
  } catch (error) {
    if (request === generation) {
      schedules.value = [];
      errors.value.schedule = true;
      handleSilentError(error, '오늘의 통독 로드');
    }
  }
}

function startTodayTongdok() {
  const next = schedules.value.find(schedule => !schedule.is_completed);
  if (!next || !plan.value || isRefreshing.value) return;
  void router.push({ path: '/bible', query: { book: next.book_code, chapter: String(next.start_chapter), tongdok: 'true', schedule: String(next.id), plan: String(plan.value.id) } });
}
function dismissTips() {
  tipsDismissed.value = true;
  try { localStorage.setItem('bible_tips_dismissed', 'true'); }
  catch (error) { tipsStorageError.value = true; handleSilentError(error, '사용 팁 설정 저장'); }
}
function formatDate(value: string) {
  // API date-only fields represent calendar dates, not UTC instants. Compare
  // local calendar days via UTC arithmetic so midnight and DST do not shift them.
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  const now = new Date();
  const days = (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(year, month - 1, day)) / 86400000;
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days > 1 && days < 7) return `${days}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
</script>

<style scoped>
.bible-home { min-width: 0; min-height: 100dvh; background: var(--color-bg-primary); color: var(--color-text-primary); font-family: var(--font-sans); letter-spacing: var(--tracking-body); }
.home-header { min-height: var(--appbar-height); padding: 0 var(--screen-gutter); display: flex; justify-content: space-between; align-items: center; }
.home-header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: var(--tracking-display); }
.header-actions { display: flex; margin-right: -8px; }
.icon-button { width: var(--hit-min); height: var(--hit-min); padding: 0; color: var(--color-text-primary); }
.home-content { display: flex; flex-direction: column; gap: 20px; padding: 4px var(--screen-gutter) 96px; max-width: var(--content-max); box-sizing: border-box; margin: 0 auto; }
.home-content > * { min-width: 0; }
.loading-state :deep(.skeleton-stats) { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px; margin-bottom: 20px; }
.section-title { margin: 0 0 10px; color: var(--color-text-secondary); font-size: 13px; font-weight: 600; }
.today-card-header, .today-progress { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.today-badge, .feature-count { background: var(--color-accent-bg); color: var(--color-accent-primary); border-radius: var(--radius-pill); font-weight: 600; }
.today-badge { padding: 4px 8px; font-size: 12px; }
.today-date { color: var(--color-text-tertiary); font-size: 12px; }
.schedule-heading { margin-top: 12px; display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
.schedule-location { margin: 0; font-size: 22px; font-weight: 700; line-height: 1.3; letter-spacing: var(--tracking-display); overflow-wrap: anywhere; }
.plan-name { margin: 0; font-size: 13px; color: var(--color-text-secondary); overflow-wrap: anywhere; }
.today-progress { margin-top: 12px; font-size: 12px; color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
.today-progress > span { white-space: nowrap; }
.progress-track { flex: 1; height: 3px; border-radius: var(--radius-pill); background: var(--color-border-default); overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-accent-primary); }
.today-start-btn { height: 46px; margin-top: 16px; box-shadow: none; }
.today-start-btn[data-state="completed"] { opacity: 1; }
.continue-card, .feature-card, .recent-record { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; color: var(--color-text-primary); text-decoration: none; font: inherit; cursor: pointer; transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.continue-card { min-height: 72px; padding: 14px 16px; background: var(--color-bg-card); border: 1px solid var(--color-border-default); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.row-icon { width: 36px; height: 36px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-accent-bg); color: var(--color-accent-primary); border-radius: var(--radius-control); }
.continue-icon { width: 38px; height: 38px; }
.row-content { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.row-content strong { font-size: 15px; font-weight: 600; }
.row-content .continue-location { font-weight: 700; }
.continue-meta, .feature-desc { color: var(--color-text-tertiary); font-size: 12px; line-height: 1.5; }
.row-arrow { flex-shrink: 0; color: var(--color-text-tertiary); }
.feature-heading { display: flex; align-items: center; gap: 6px; }
.feature-count { padding: 2px 7px; font-size: 11px; font-variant-numeric: tabular-nums; }
.grouped-card { overflow: hidden; }
.feature-card, .recent-record { min-height: 56px; background: transparent; border: 0; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.section-heading .section-title { margin: 0; }
.dismiss-tips-btn { padding-inline: 8px; font-size: 12px; font-weight: 500; color: var(--color-text-tertiary); }
.tip-item strong { font-size: 13px; font-weight: 600; }
.tip-item p { margin: 4px 0 0; font-size: 13px; line-height: 1.5; color: var(--color-text-secondary); }
.recent-record { justify-content: space-between; font-size: 14px; font-weight: 600; }
.recent-record time { color: var(--color-text-tertiary); font-size: 12px; font-weight: 500; white-space: nowrap; }
.no-plan-hint { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); }
.no-plan-hint > svg { flex-shrink: 0; color: var(--color-text-tertiary); }
.no-plan-hint p { margin: 0; flex: 1; font-size: 12px; line-height: 1.5; color: var(--color-text-secondary); }
.no-plan-hint .app-button { padding-inline: 4px; white-space: nowrap; font-size: 12px; }
.info-row, .error-heading { display: flex; align-items: center; gap: 10px; }
.info-row > svg, .error-heading > svg { flex-shrink: 0; color: var(--color-accent-primary); }
.info-row h2, .error-heading h2 { margin: 0; font-size: 15px; font-weight: 600; }
.info-row .plan-name { margin-top: 4px; }
.no-schedule .app-button { margin-top: 8px; }
.error-card p { margin: 8px 0; font-size: 13px; line-height: 1.5; color: var(--color-text-secondary); }
.error-card .app-button { margin-top: 8px; }
.storage-error { margin: 0; font-size: 12px; line-height: 1.5; color: var(--color-error); }
.welcome-card { text-align: center; padding-block: 32px; }
.welcome-icon { display: grid; place-items: center; width: 56px; height: 56px; margin: 0 auto 20px; border-radius: var(--radius-card); color: var(--color-accent-primary); background: var(--color-accent-bg); }
.welcome-card h2 { margin: 0; font-size: 20px; line-height: 1.4; font-weight: 700; letter-spacing: var(--tracking-display); text-wrap: balance; }
.welcome-card p { margin: 8px 0 24px; color: var(--color-text-secondary); font-size: 14px; line-height: 1.5; }
.welcome-actions { display: flex; flex-direction: column; gap: 10px; }
.toc-btn { height: 48px; }
.continue-card:hover, .feature-card:hover, .recent-record:hover { background: var(--color-bg-hover); }
.continue-card:active, .feature-card:active, .recent-record:active { transform: scale(.97); }
.continue-card:focus-visible, .feature-card:focus-visible, .recent-record:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: -3px; }
@media (min-width: 1024px) {
  .bible-home { padding-top: 36px; }
  .home-header { padding-inline: 40px; }
  .home-content { padding: 20px 40px 40px; }
}
@media (prefers-reduced-motion: reduce) {
  .continue-card, .feature-card, .recent-record { transition: none; }
  .continue-card:active, .feature-card:active, .recent-record:active { transform: none; }
}
</style>
