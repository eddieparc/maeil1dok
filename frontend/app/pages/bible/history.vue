<template>
  <BibleSubpageLayout title="읽기 기록" :loading="isLoading">
    <template #skeleton>
      <SkeletonList :count="5" variant="history" />
    </template>

    <div class="history-content">
      <!-- 요약 카드 -->
      <div class="summary-cards">
        <div class="summary-card total">
          <div class="card-icon">
            <BookIcon :size="20" />
          </div>
          <div class="card-content">
            <div class="card-value">
              {{ stats.total_chapters_read }} / {{ totalChapters }}
            </div>
            <div class="card-label">전체 진도</div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${totalProgress}%` }"
              />
            </div>
          </div>
        </div>

        <div class="summary-card streak">
          <div class="card-icon">
            <StarIcon :size="20" />
          </div>
          <div class="card-content">
            <div class="card-value">{{ stats.current_streak }}일</div>
            <div class="card-label">연속 읽기</div>
          </div>
        </div>

        <div class="summary-card books">
          <div class="card-icon">
            <CheckIcon :size="20" />
          </div>
          <div class="card-content">
            <div class="card-value">{{ stats.books_completed }} / 66권</div>
            <div class="card-label">완독</div>
          </div>
        </div>
      </div>

      <!-- 캘린더 -->
      <section class="calendar-section">
        <h2 class="section-title">읽기 캘린더</h2>
        <ReadingCalendar :reading-dates="readingDates" />
      </section>

      <!-- 책별 진도 -->
      <section class="books-section">
        <div class="section-header">
          <h2 class="section-title">책별 진도</h2>
          <div class="filter-tabs">
            <button
              :class="{ active: filter === 'all' }"
              @click="filter = 'all'"
            >
              전체
            </button>
            <button
              :class="{ active: filter === 'old' }"
              @click="filter = 'old'"
            >
              구약
            </button>
            <button
              :class="{ active: filter === 'new' }"
              @click="filter = 'new'"
            >
              신약
            </button>
          </div>
        </div>

        <div class="books-grid">
          <div
            v-for="book in filteredBooks"
            :key="book.id"
            class="book-card"
            :class="{ completed: book.read === book.total }"
            @click="goToBook(book.id)"
          >
            <div class="book-name">{{ book.name }}</div>
            <div class="book-progress">
              <div class="progress-text">
                {{ book.read }} / {{ book.total }}장
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${(book.read / book.total) * 100}%` }"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </BibleSubpageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '~/composables/useApi';
import { useBibleData } from '~/composables/useBibleData';
import { useErrorHandler } from '~/composables/useErrorHandler';
import BibleSubpageLayout from '~/components/bible/BibleSubpageLayout.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';
import type { ReadingStats, ReadingStatsResponse, ReadingDatesResponse } from '~/types/bible';

definePageMeta({
  layout: 'default'
});

const router = useRouter();
const api = useApi();
const { bibleBooks } = useBibleData();
const { handleSilentError } = useErrorHandler();

const isLoading = ref(true);

const stats = ref<ReadingStats>({
  total_chapters_read: 0,
  books_read: 0,
  books_completed: 0,
  current_streak: 0,
  books_progress: {}
});
const readingDates = ref<string[]>([]);
const filter = ref<'all' | 'old' | 'new'>('all');

// 전체 장 수
const totalChapters = computed(() => {
  const all = [...bibleBooks.old, ...bibleBooks.new];
  return all.reduce((sum, book) => sum + book.chapters, 0);
});

// 전체 진도 퍼센트
const totalProgress = computed(() => {
  if (totalChapters.value === 0) return 0;
  return (stats.value.total_chapters_read / totalChapters.value) * 100;
});

// 책 목록 with 진도
const booksWithProgress = computed(() => {
  const all = [
    ...bibleBooks.old.map(b => ({ ...b, testament: 'old' as const })),
    ...bibleBooks.new.map(b => ({ ...b, testament: 'new' as const }))
  ];

  return all.map(book => ({
    ...book,
    read: stats.value.books_progress[book.id]?.read || 0,
    total: book.chapters
  }));
});

// 필터링된 책
const filteredBooks = computed(() => {
  if (filter.value === 'all') return booksWithProgress.value;
  return booksWithProgress.value.filter(b => b.testament === filter.value);
});

// 통계 로드
const loadStats = async () => {
  try {
    const response = await api.get('/api/v1/todos/bible/personal-records/stats/');
    const statsData = response.data as ReadingStatsResponse | undefined;
    if (statsData?.success && statsData?.stats) {
      stats.value = statsData.stats;
    }

    // 읽기 날짜 로드 (캘린더용)
    const datesResponse = await api.get('/api/v1/todos/bible/personal-records/dates/');
    const datesData = datesResponse.data as ReadingDatesResponse | undefined;
    if (datesData?.success && datesData?.dates) {
      readingDates.value = datesData.dates;
    }
  } catch (error) {
    handleSilentError(error, '읽기 통계 로드');
  } finally {
    isLoading.value = false;
  }
};

const goToBook = (bookId: string) => {
  router.push(`/bible?book=${bookId}&chapter=1`);
};

onMounted(() => {
  loadStats();
});
</script>

<style scoped>
/*
 * History Page specific styles
 * 공통 스타일은 bible-page.css에서 관리됨
 */

.history-content {
  padding: 1rem;
}

/* 요약 카드 */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  background: var(--color-bg-card, #fff);
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.summary-card.total .card-icon {
  background: var(--primary-light, #eef2ff);
  color: var(--primary-color, #2A1111);
}

.summary-card.streak .card-icon {
  background: #fef3c7;
  color: #f59e0b;
}

.summary-card.books .card-icon {
  background: #d1fae5;
  color: #2A1111;
}

.card-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary, #1f2937);
}

.card-label {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
  margin-top: 0.25rem;
}

.summary-card.total .card-content {
  width: 100%;
}

/* 진도 바 */
.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--color-bg-secondary, #f3f4f6);
  border-radius: 2px;
  margin-top: 0.5rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color, #2A1111);
  transition: width 0.3s ease;
}

/* 섹션 */
.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
  margin-bottom: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header .section-title {
  margin-bottom: 0;
}

.calendar-section {
  margin-bottom: 1.5rem;
}

/* 필터 탭 */
.filter-tabs {
  display: flex;
  gap: 0.5rem;
}

.filter-tabs button {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 16px;
  background: transparent;
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tabs button:hover {
  background: var(--color-bg-secondary, #f3f4f6);
}

.filter-tabs button.active {
  background: var(--primary-color, #2A1111);
  color: white;
  border-color: var(--primary-color, #2A1111);
}

/* 책 그리드 */
.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}

.book-card {
  background: var(--color-bg-card, #fff);
  border-radius: 8px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--color-border, #e5e7eb);
}

.book-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.book-card.completed {
  border-color: var(--color-success, #2A1111);
  background: var(--color-success-light, #d1fae5);
}

.book-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #1f2937);
  margin-bottom: 0.5rem;
}

.progress-text {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
  margin-bottom: 0.25rem;
}

.book-card .progress-fill {
  background: var(--color-success, #2A1111);
}

/* 다크모드 */
:root.dark .summary-card {
  background: var(--color-bg-card);
}

:root.dark .summary-card.streak .card-icon {
  background: rgba(245, 158, 11, 0.2);
}

:root.dark .summary-card.books .card-icon {
  background: rgba(42, 17, 17, 0.2);
}

:root.dark .book-card {
  background: var(--color-bg-card);
  border-color: var(--color-border);
}

:root.dark .book-card.completed {
  background: rgba(42, 17, 17, 0.15);
}

:root.dark .filter-tabs button:hover {
  background: var(--color-bg-tertiary);
}

/* 모바일 반응형 */
@media (max-width: 480px) {
  .summary-cards {
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .summary-card {
    padding: 0.75rem 0.5rem;
  }

  .card-icon {
    width: 32px;
    height: 32px;
  }

  .card-icon svg {
    width: 16px;
    height: 16px;
  }

  .card-value {
    font-size: 0.875rem;
  }

  .card-label {
    font-size: 0.625rem;
  }

  .books-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.5rem;
  }

  .book-card {
    padding: 0.625rem;
  }

  .book-name {
    font-size: 0.8125rem;
  }
}
</style>
