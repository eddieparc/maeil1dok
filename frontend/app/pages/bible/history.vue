<template>
  <div class="bible-page history-page">
    <header class="history-header">
      <button type="button" class="back-button" aria-label="뒤로 가기" @click="router.back()"><ChevronLeft :size="20" aria-hidden="true" /></button>
      <h1>읽기 기록</h1>
    </header>

    <div v-if="view === 'pending'" class="history-loading" data-state="pending" role="status" aria-label="읽기 기록을 불러오는 중"><SkeletonList :count="5" variant="history" /></div>
    <div v-else-if="view === 'session-unknown'" class="history-session" data-state="session-unknown" role="status">
      <p>로그인 상태를 확인하지 못했어요. 연결을 확인하고 다시 시도해주세요.</p>
      <AppButton variant="secondary" data-action="retry-auth" :loading="authRetrying" @click="retryAuth">다시 시도</AppButton>
    </div>
    <div v-else-if="view === 'guest'" class="history-session" data-state="guest">
      <p>읽기 기록을 보려면 로그인이 필요해요.</p>
      <AppButton to="/login" data-action="login">로그인</AppButton>
    </div>
    <div v-else class="history-content" data-state="ready">
      <SkeletonList v-if="statsLoading && !stats" :count="5" variant="history" />
      <div v-if="statsError" class="history-error" role="alert">
        <p>읽기 통계를 불러오지 못했어요.</p>
        <AppButton variant="secondary" data-retry="stats" :loading="statsLoading" @click="loadStats">다시 시도</AppButton>
      </div>
      <div v-if="stats" class="summary-cards">
        <div class="summary-card total">
          <div class="card-label">전체 진도</div>
          <div class="card-value">{{ stats.total_chapters_read }}<span> / {{ totalChapters }}장</span></div>
          <progress :value="stats.total_chapters_read" :max="totalChapters" aria-label="전체 읽기 진도" />
        </div>
        <div class="summary-card streak">
          <div class="card-label">연속 읽기</div>
          <div class="card-value">{{ stats.current_streak }}<span>일</span></div>
        </div>
        <div class="summary-card books">
          <div class="card-label">완독</div>
          <div class="card-value">{{ stats.books_completed }}<span> / {{ allBooks.length }}권</span></div>
        </div>
      </div>

      <section class="calendar-section" aria-labelledby="history-calendar-title">
        <h2 id="history-calendar-title" class="section-title">읽기 캘린더</h2>
        <SkeletonCalendar v-if="datesLoading && !readingDates" />
        <div v-if="datesError" class="history-error" role="alert">
          <p>읽은 날짜를 불러오지 못했어요.</p>
          <AppButton variant="secondary" data-retry="dates" :loading="datesLoading" @click="loadDates">다시 시도</AppButton>
        </div>
        <ReadingCalendar v-if="readingDates" :reading-dates="readingDates" />
      </section>

      <section v-if="stats" class="books-section" aria-labelledby="history-books-title">
        <div class="section-header">
          <h2 id="history-books-title" class="section-title">책별 진도</h2>
          <SegmentedControl v-model="filter" :options="filterOptions" aria-label="책별 진도 필터" />
        </div>
        <div id="history-books-panel" class="books-grid" role="tabpanel" :aria-labelledby="`history-filter-${filter}`">
          <button
            v-for="book in filteredBooks"
            :key="book.id"
            type="button"
            class="book-card"
            :data-book="book.id"
            :class="{ completed: book.completed, unstarted: book.read === 0 }"
            :aria-label="`${book.name}, ${book.read} / ${book.total}장${book.completed ? ', 완독' : ''}, 1장 읽기`"
            @click="goToBook(book.id)"
          >
            <span class="book-heading"><span class="book-name">{{ book.name }}</span><Check v-if="book.completed" class="completion-check" :size="16" aria-hidden="true" /></span>
            <span class="progress-text">{{ book.read }} / {{ book.total }}장</span>
            <progress :value="book.read" :max="book.total" :aria-label="`${book.name} 읽기 진도`" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { Check, ChevronLeft } from '@lucide/vue';
import { useApi } from '~/composables/useApi';
import { useAuthService } from '~/composables/useAuthService';
import { useBibleData } from '~/composables/useBibleData';
import { useErrorHandler } from '~/composables/useErrorHandler';
import ReadingCalendar from '~/components/bible/ReadingCalendar.vue';
import SegmentedControl from '~/components/ui/SegmentedControl.vue';
import AppButton from '~/components/ui/AppButton.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';
import SkeletonCalendar from '~/components/ui/skeleton/SkeletonCalendar.vue';
import type { ApiResponseBody } from '~/types/api-contract';

definePageMeta({ layout: 'default' });
const router = useRouter();
const api = useApi();
const auth = useAuthService();
const { bibleBooks } = useBibleData();
const { handleSilentError } = useErrorHandler();
type ReadingStats = ApiResponseBody<'/api/v1/todos/bible/personal-records/stats/', 'get'>['stats'];
type HistoryView = 'pending' | 'session-unknown' | 'guest' | 'ready';
const stats = ref<ReadingStats | null>(null);
const readingDates = ref<string[] | null>(null);
const statsLoading = ref(false);
const datesLoading = ref(false);
const statsError = ref(false);
const datesError = ref(false);
const authRetrying = ref(false);
let requestGeneration = 0;
const view = computed((): HistoryView => {
  switch (auth.authState.value) {
    case 'loading':
      return 'pending';
    case 'unknown-offline':
      return 'session-unknown';
    case 'unauthenticated':
      return 'guest';
    case 'authenticated':
      return 'ready';
    default: {
      const unreachable: never = auth.authState.value;
      return unreachable;
    }
  }
});
const identityKey = computed(() => {
  switch (view.value) {
    case 'pending':
    case 'session-unknown':
      return null;
    case 'guest':
      return 'guest';
    case 'ready':
      return `user:${auth.user.value?.id ?? ''}`;
    default: {
      const unreachable: never = view.value;
      return unreachable;
    }
  }
});
const filter = ref<string | number>('all');
const filterOptions = [
  { value: 'all', label: '전체', id: 'history-filter-all', controls: 'history-books-panel' },
  { value: 'old', label: '구약', id: 'history-filter-old', controls: 'history-books-panel' },
  { value: 'new', label: '신약', id: 'history-filter-new', controls: 'history-books-panel' }
];
const allBooks = [
  ...bibleBooks.old.map(book => ({ ...book, testament: 'old' })),
  ...bibleBooks.new.map(book => ({ ...book, testament: 'new' }))
];
const totalChapters = allBooks.reduce((sum, book) => sum + book.chapters, 0);
const filteredBooks = computed(() => {
  if (!stats.value) return [];
  const progress = stats.value.books_progress;
  return allBooks.filter(book => filter.value === 'all' || book.testament === filter.value).map(book => {
    const read = progress[book.id]?.read ?? 0;
    const total = progress[book.id]?.total ?? book.chapters;
    return { ...book, read, total, completed: total > 0 && read >= total };
  });
});

async function loadStats() {
  if (view.value !== 'ready') return;
  const generation = requestGeneration;
  statsLoading.value = true;
  statsError.value = false;
  try {
    const response = await api.GET('/api/v1/todos/bible/personal-records/stats/');
    if (generation !== requestGeneration) return;
    if (!response.data.success) throw new Error('Reading statistics request was unsuccessful');
    stats.value = response.data.stats;
  } catch (error) {
    if (generation !== requestGeneration) return;
    statsError.value = true;
    handleSilentError(error, '읽기 통계 로드');
  } finally {
    if (generation === requestGeneration) statsLoading.value = false;
  }
}
async function loadDates() {
  if (view.value !== 'ready') return;
  const generation = requestGeneration;
  datesLoading.value = true;
  datesError.value = false;
  try {
    const response = await api.GET('/api/v1/todos/bible/personal-records/dates/');
    if (generation !== requestGeneration) return;
    if (!response.data.success) throw new Error('Reading dates request was unsuccessful');
    readingDates.value = response.data.dates;
  } catch (error) {
    if (generation !== requestGeneration) return;
    datesError.value = true;
    handleSilentError(error, '읽기 날짜 로드');
  } finally {
    if (generation === requestGeneration) datesLoading.value = false;
  }
}
function resetPersonalHistory() {
  stats.value = null;
  readingDates.value = null;
  statsError.value = false;
  datesError.value = false;
  statsLoading.value = false;
  datesLoading.value = false;
}
async function retryAuth() {
  authRetrying.value = true;
  try {
    await auth.revalidate();
  } finally {
    authRetrying.value = false;
  }
}
const goToBook = (bookId: string) => { router.push(`/bible?book=${bookId}&chapter=1`); };
watch(identityKey, (key) => {
  requestGeneration += 1;
  if (key === null) {
    statsError.value = false;
    datesError.value = false;
    return;
  }
  if (key === 'guest') {
    resetPersonalHistory();
    return;
  }
  void Promise.all([loadStats(), loadDates()]);
}, { immediate: true });
onMounted(() => { void auth.initialize(); });
onBeforeUnmount(() => { requestGeneration += 1; });
</script>

<style scoped>
.history-page { color: var(--color-text-primary); background: var(--color-bg-primary); letter-spacing: var(--tracking-body); }
.history-header { display: flex; align-items: center; gap: 8px; min-height: var(--appbar-height); padding: 0 12px; border-bottom: 1px solid var(--color-border-default); }
.history-header h1 { margin: 0; font-size: 16px; font-weight: 700; }
.back-button { display: grid; place-items: center; min-width: var(--hit-min); min-height: var(--hit-min); border: 0; border-radius: var(--radius-pill); background: transparent; color: var(--color-text-primary); cursor: pointer; }
.back-button:hover { background: var(--color-bg-tertiary); }
.back-button:active { transform: scale(.97); }
.history-content, .history-loading, .history-session { padding: var(--screen-gutter); }
.history-content { display: flex; flex-direction: column; gap: 20px; }
.history-session { display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; color: var(--color-text-secondary); }
.history-session p { margin: 0; font-size: 14px; }
.summary-cards { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 8px; }
.summary-card { min-width: 0; padding: 14px; border: 1px solid var(--color-border-default); border-radius: 16px; background: var(--color-bg-card); box-shadow: var(--shadow-card); }
.card-label { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
.card-value { margin-top: 8px; font-size: 20px; font-weight: 700; line-height: 1; letter-spacing: var(--tracking-display); font-variant-numeric: tabular-nums; }
.card-value span { font-size: 12px; font-weight: 600; color: var(--color-text-tertiary); white-space: nowrap; }
.streak .card-value, .streak .card-value span { color: var(--color-reading-current); }
progress { display: block; appearance: none; width: 100%; height: 3px; margin-top: 12px; border: 0; border-radius: 2px; overflow: hidden; background: var(--color-border-default); color: var(--color-accent-primary); }
progress::-webkit-progress-bar { background: var(--color-border-default); }
progress::-webkit-progress-value { background: var(--color-accent-primary); }
progress::-moz-progress-bar { background: var(--color-accent-primary); }
.section-title { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--color-text-secondary); }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.section-header .section-title { margin: 0; }
.books-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.book-card { min-width: var(--hit-min); min-height: var(--hit-min); padding: 16px; border: 1px solid var(--color-border-default); border-radius: 16px; background: var(--color-bg-card); color: var(--color-text-primary); text-align: left; font: inherit; cursor: pointer; transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.book-card:hover { background: var(--color-bg-tertiary); }
.book-card:active { transform: scale(.97); }
.book-card.completed { border-color: var(--color-accent-primary); }
.book-card.unstarted { opacity: .7; }
.book-heading { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.book-name { font-size: 14px; font-weight: 700; }
.completion-check { color: var(--color-accent-primary); flex-shrink: 0; }
.progress-text { display: block; margin-top: 8px; font-size: 12px; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
.book-card:not(.completed) progress { color: var(--color-reading-current); }
.book-card:not(.completed) progress::-webkit-progress-value { background: var(--color-reading-current); }
.book-card:not(.completed) progress::-moz-progress-bar { background: var(--color-reading-current); }
.history-error { padding: 16px; border: 1px solid var(--color-border-default); border-radius: 16px; background: var(--color-bg-card); }
.history-error p { margin: 0 0 12px; color: var(--color-error); font-size: 14px; }
@media (max-width: 360px) { .summary-card { padding: 12px 8px; } .card-value { font-size: 18px; } }
@media (prefers-reduced-motion: reduce) { .book-card { transition: none; } .back-button:active, .book-card:active { transform: none; } }
</style>
