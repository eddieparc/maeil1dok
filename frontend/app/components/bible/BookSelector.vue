<template>
  <BottomSheet
    :model-value="modelValue"
    title="성경 선택"
    class="book-selector-sheet"
    @update:model-value="$emit('update:modelValue', $event)"
  >

    <!-- 역본 선택 슬라이드 -->
    <div class="version-slide-section">
      <div class="version-row">
        <span v-if="compareEnabled" class="version-row-label">본문</span>
        <div class="version-scroll-container">
          <button
            v-for="(name, code) in VISIBLE_VERSION_NAMES"
            :key="code"
            type="button"
            :aria-pressed="code === currentVersion"
            :class="['version-chip', { active: code === currentVersion }]"
            @click="$emit('version-select', String(code))"
          >
            {{ name }}
          </button>
        </div>
        <button
          class="version-chip compare-toggle"
          :class="{ 'is-on': compareEnabled }"
          :aria-pressed="compareEnabled"
          type="button"
          data-testid="book-selector-compare"
          title="역본 비교"
          aria-label="역본 비교"
          @click="$emit('compare-toggle')"
        >
          <Columns2Icon :size="14" />
          <span>역본 비교</span>
        </button>
      </div>

      <!-- 비교 역본 선택 (역본 비교 켜졌을 때 한 줄 추가) -->
      <div v-if="compareEnabled" class="version-row secondary">
        <div class="version-scroll-container">
          <button
            v-for="(name, code) in VISIBLE_VERSION_NAMES"
            :key="code"
            type="button"
            :aria-pressed="code === secondaryVersion"
            :class="['version-chip', { active: code === secondaryVersion }]"
            @click="$emit('compare-version-select', String(code))"
          >
            {{ name }}
          </button>
        </div>
        <span class="version-row-label">비교</span>
      </div>
    </div>

    <!-- 검색 섹션 -->
    <div class="search-section">
      <!-- 현재 선택 상태 표시 (장/절 입력 모드일 때) -->
      <div v-if="inputMode !== 'search'" class="selection-status">
        <button class="status-badge" @click="resetToSearchMode">
          <span>{{ confirmedBookName }}</span>
          <span v-if="confirmedChapter"> {{ confirmedChapter }}{{ getChapterUnit(confirmedBookId) }}</span>
          <XCircleIcon :size="14" />
        </button>
      </div>

      <div class="search-input-wrapper">
        <SearchIcon v-if="inputMode === 'search'" class="search-icon" :size="18" />
        <span v-else class="input-prefix">{{ inputMode === 'chapter' ? getChapterUnit(confirmedBookId) : '절' }}</span>
        <input
          ref="searchInputRef"
          :value="currentInputValue"
          type="text"
          :aria-label="inputPlaceholder"
          :aria-invalid="inputError || undefined"
          :inputmode="inputMode === 'search' ? 'text' : 'numeric'"
          :enterkeyhint="inputMode === 'search' ? 'search' : 'done'"
          class="search-input"
          :class="{ 'numeric-input': inputMode !== 'search', 'input-error': inputError }"
          :placeholder="inputPlaceholder"
          @input="handleInput"
          @keydown="handleSearchKeydown"
        />
        <button
          v-if="currentInputValue"
          class="search-clear-button"
          type="button"
          aria-label="입력 지우기"
          @click="inputMode === 'search' ? searchQuery = '' : (inputMode === 'chapter' ? chapterInput = '' : verseInput = '')"
        >
          <XCircleIcon :size="16" />
        </button>
        <button
          v-if="inputMode !== 'search'"
          class="search-submit-button"
          type="button"
          aria-label="입력한 장/절로 이동"
          @click="handleSubmitButton"
        >
          <ArrowRightIcon :size="17" />
        </button>
      </div>

      <!-- 검색 결과 미리보기 (검색 모드일 때만) -->
      <div v-if="inputMode === 'search' && searchResults.length > 0" class="search-result-preview">
        <div class="ai-result-label">
          <SparkleIcon class="ai-sparkle" :size="14" />
          <span>{{ searchResults.length > 1 ? `${searchResults.length}개를 찾았어요` : 'AI가 찾았어요' }}</span>
        </div>

        <!-- 여러 후보가 있을 때 -->
        <div v-if="searchResults.length > 1" class="search-results-list">
          <button
            v-for="(result, index) in searchResults"
            :key="`${result.bookId}-${index}`"
            :aria-pressed="index === selectedResultIndex"
            :class="['search-result-item', { selected: index === selectedResultIndex }]"
            @click="selectSearchResult(index)"
          >
            <span class="result-book">{{ result.bookName }}</span>
            <span v-if="result.chapter" class="result-chapter">{{ result.chapter }}{{ getChapterUnit(result.bookId) }}</span>
            <span v-if="result.verse" class="result-verse">{{ result.verse }}절</span>
          </button>
        </div>

        <!-- 선택된 결과로 이동 버튼 -->
        <button v-if="currentSearchResult" class="search-result-button" @click="goToSearchResult">
          <span class="result-book">{{ currentSearchResult.bookName }}</span>
          <span v-if="currentSearchResult.chapter" class="result-chapter">{{ currentSearchResult.chapter }}{{ getChapterUnit(currentSearchResult.bookId) }}</span>
          <span v-if="currentSearchResult.verse" class="result-verse">{{ currentSearchResult.verse }}절</span>
          <span v-else-if="!currentSearchResult.chapter" class="result-hint">{{ getChapterUnit(currentSearchResult.bookId) }}을 선택해주세요</span>
          <span class="result-action">바로가기</span>
          <ArrowRightIcon class="result-arrow" :size="18" />
        </button>
      </div>

      <div v-if="inputMode === 'chapter'" class="input-hint">
        숫자 입력 후 Enter
      </div>
      <div v-if="inputMode === 'verse'" class="input-hint">
        절 입력 후 Enter, 또는 그냥 Enter로 이동
      </div>
    </div>

    <div class="modal-body">
      <div class="books-section" ref="booksSection">
        <div class="testament-group">
          <div class="testament-header">구약</div>
          <div class="books-list">
            <button
              v-for="book in bibleBooks.old"
              :key="book.id"
              :data-id="book.id"
              :aria-pressed="selectedBookId === book.id"
              :class="['book-item', { active: selectedBookId === book.id }]"
              @click="selectBook(book.id)"
            >
              <span class="book-name">{{ book.name }}</span>
            </button>
          </div>
        </div>
        <div class="testament-group">
          <div class="testament-header">신약</div>
          <div class="books-list">
            <button
              v-for="book in bibleBooks.new"
              :key="book.id"
              :data-id="book.id"
              :aria-pressed="selectedBookId === book.id"
              :class="['book-item', { active: selectedBookId === book.id }]"
              @click="selectBook(book.id)"
            >
              <span class="book-name">{{ book.name }}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="chapters-section" ref="chaptersSection">
        <div class="chapters-list">
          <button
            v-for="chapter in chaptersArray"
            :key="chapter"
            :data-chapter="chapter"
            :aria-current="chapter === currentChapter && selectedBookId === currentBook ? 'location' : undefined"
            :class="[
              'chapter-item',
              { active: chapter === currentChapter && selectedBookId === currentBook },
              { searched: inputMode === 'search' && currentSearchResult?.bookId === selectedBookId && currentSearchResult.chapter === chapter },
              { read: readChapters?.[selectedBookId]?.includes(chapter) === true },
            ]"
            @click="selectChapter(chapter)"
          >
            <span class="chapter-num">{{ chapter }}{{ getChapterUnit(selectedBookId) }}</span>
          </button>
        </div>
      </div>
    </div>
  </BottomSheet>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import BottomSheet from '~/components/ui/BottomSheet.vue';
import { useBibleData, type SearchResult, VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';
import SearchIcon from '~/components/icons/SearchIcon.vue';
import XCircleIcon from '~/components/icons/XCircleIcon.vue';
import SparkleIcon from '~/components/icons/SparkleIcon.vue';
import ArrowRightIcon from '~/components/icons/ArrowRightIcon.vue';
import { Columns2Icon } from '@lucide/vue';

const props = defineProps<{
  modelValue: boolean;
  currentBook: string;
  currentChapter: number;
  currentVersion?: string;
  /** Actual read chapter numbers keyed by book ID; omitted books have no read marks. */
  readChapters?: Readonly<Record<string, readonly number[]>>;
  compareEnabled?: boolean;
  secondaryVersion?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'select': [book: string, chapter: number, verse?: number];
  'version-select': [version: string];
  'compare-toggle': [];
  'compare-version-select': [version: string];
}>();

const { bibleBooks, getChaptersArray, parseSearchQuery } = useBibleData();

const isPsalms = (bookId: string) => bookId === 'psa';
const getChapterUnit = (bookId: string) => isPsalms(bookId) ? '편' : '장';

type InputMode = 'search' | 'chapter' | 'verse';

// 상태
const searchQuery = ref('');
const selectedBookId = ref(props.currentBook);
const selectedResultIndex = ref(0);
const searchInputRef = ref<HTMLInputElement | null>(null);
const booksSection = ref<HTMLElement | null>(null);
const chaptersSection = ref<HTMLElement | null>(null);

// 단계별 입력 상태
const inputMode = ref<InputMode>('search');
const chapterInput = ref('');
const verseInput = ref('');
const confirmedBookId = ref('');
const confirmedBookName = ref('');
const confirmedChapter = ref(0);
const inputError = ref(false);

// 선택된 책의 장 배열
const chaptersArray = computed(() => getChaptersArray(selectedBookId.value));

// 검색 결과
const searchResults = computed(() => parseSearchQuery(searchQuery.value));

// 현재 선택된 검색 결과
const currentSearchResult = computed<SearchResult | null>(() => {
  const results = searchResults.value;
  if (results.length === 0) return null;
  const index = Math.min(selectedResultIndex.value, results.length - 1);
  return results[index] ?? null;
});

const inputPlaceholder = computed(() => {
  const unit = getChapterUnit(confirmedBookId.value);
  if (inputMode.value === 'chapter') {
    return `${confirmedBookName.value} 몇 ${unit}?`;
  } else if (inputMode.value === 'verse') {
    return `${confirmedBookName.value} ${confirmedChapter.value}${unit} 몇 절? (생략 가능)`;
  }
  return '예: 창1:3, ㅊㅅㄱ, 요한 3:16';
});

// 현재 입력값 (모드에 따라)
const currentInputValue = computed(() => {
  if (inputMode.value === 'chapter') return chapterInput.value;
  if (inputMode.value === 'verse') return verseInput.value;
  return searchQuery.value;
});

// 검색어 변경 시 인덱스 리셋
watch(searchQuery, () => {
  selectedResultIndex.value = 0;
});

// 검색 결과 변경 시 책 선택 및 스크롤 연동
watch(currentSearchResult, (result) => {
  if (result && result.bookId && inputMode.value === 'search') {
    selectedBookId.value = result.bookId;
    nextTick(() => {
      scrollToSelectedBook();
      if (result.chapter) scrollToSearchedChapter(result.chapter);
    });
  }
});

// 모달 열릴 때 초기화
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    resetToSearchMode();
    selectedBookId.value = props.currentBook;
    nextTick(() => {
      scrollToSelectedBook();
      scrollToSelectedChapter();
    });
  }
});

// 검색 모드로 리셋
const resetToSearchMode = () => {
  inputMode.value = 'search';
  searchQuery.value = '';
  chapterInput.value = '';
  verseInput.value = '';
  confirmedBookId.value = '';
  confirmedBookName.value = '';
  confirmedChapter.value = 0;
  inputError.value = false;
};

// 닫기
const close = () => {
  emit('update:modelValue', false);
};

// 책 선택 (리스트에서 클릭)
const selectBook = (bookId: string) => {
  selectedBookId.value = bookId;
  // 장 입력 모드로 전환
  enterChapterMode(bookId);
};

// 장 선택 (리스트에서 클릭)
const selectChapter = (chapter: number) => {
  emit('select', selectedBookId.value, chapter);
  close();
};

// 검색 결과 선택
const selectSearchResult = (index: number) => {
  selectedResultIndex.value = index;
};

// 장 입력 모드로 전환
const enterChapterMode = (bookId: string) => {
  const book = [...bibleBooks.old, ...bibleBooks.new].find(b => b.id === bookId);
  if (!book) return;

  confirmedBookId.value = bookId;
  confirmedBookName.value = book.name;
  selectedBookId.value = bookId;
  inputMode.value = 'chapter';
  chapterInput.value = '';
  
  nextTick(() => {
    searchInputRef.value?.focus({ preventScroll: true });
    scrollToSelectedBook();
  });
};

// 절 입력 모드로 전환
const enterVerseMode = (chapter: number) => {
  confirmedChapter.value = chapter;
  inputMode.value = 'verse';
  verseInput.value = '';
  
  nextTick(() => {
    searchInputRef.value?.focus({ preventScroll: true });
  });
};

// 최종 확정 및 닫기
const confirmAndClose = (verse?: number) => {
  emit('select', confirmedBookId.value, confirmedChapter.value, verse);
  close();
};

// 검색 결과로 이동 (기존 로직)
const goToSearchResult = () => {
  const result = currentSearchResult.value;
  if (!result) return;

  if (result.chapter) {
    // 장이 있으면 바로 이동; 절은 선택 사항
    emit('select', result.bookId, result.chapter, result.verse ?? undefined);
    close();
  } else {
    // 책만 있으면 장 입력 모드로
    enterChapterMode(result.bookId);
  }
};

// 입력값 변경 핸들러
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = target.value;

  if (inputMode.value === 'search') {
    searchQuery.value = value;
    inputError.value = false;
  } else if (inputMode.value === 'chapter') {
    // 숫자 외 입력 시 에러
    if (value && !/^\d*$/.test(value)) {
      inputError.value = true;
      // 숫자만 남기기
      chapterInput.value = value.replace(/[^0-9]/g, '');
      // 0.5초 후 에러 상태 해제
      setTimeout(() => { inputError.value = false; }, 500);
    } else {
      inputError.value = false;
      chapterInput.value = value;
    }
  } else if (inputMode.value === 'verse') {
    // 숫자 외 입력 시 에러
    if (value && !/^\d*$/.test(value)) {
      inputError.value = true;
      verseInput.value = value.replace(/[^0-9]/g, '');
      setTimeout(() => { inputError.value = false; }, 500);
    } else {
      inputError.value = false;
      verseInput.value = value;
    }
  }
};

// 검색 입력 핸들러
const handleSearchKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleEnterKey();
  } else if (event.key === 'Escape') {
    if (inputMode.value !== 'search') {
      resetToSearchMode();
    } else {
      searchQuery.value = '';
      searchInputRef.value?.blur();
    }
  } else if (event.key === 'Backspace' && inputMode.value !== 'search') {
    // 숫자 입력 모드에서 비어있을 때 백스페이스 누르면 이전 모드로
    if (inputMode.value === 'verse' && verseInput.value === '') {
      event.preventDefault();
      inputMode.value = 'chapter';
      chapterInput.value = '';
    } else if (inputMode.value === 'chapter' && chapterInput.value === '') {
      event.preventDefault();
      resetToSearchMode();
    }
  }
};

const handleSubmitButton = () => {
  handleEnterKey();
};

// 엔터 키 처리
const handleEnterKey = () => {
  if (inputMode.value === 'search') {
    // 검색 모드: 검색 결과가 있으면 선택
    if (currentSearchResult.value) {
      goToSearchResult();
    }
  } else if (inputMode.value === 'chapter') {
    // 장 입력 모드
    const chapter = parseInt(chapterInput.value, 10);
    const maxChapter = getChaptersArray(confirmedBookId.value).length;
    
    if (chapter > 0 && chapter <= maxChapter) {
      enterVerseMode(chapter);
      return;
    }

    inputError.value = true;
    setTimeout(() => { inputError.value = false; }, 500);
  } else if (inputMode.value === 'verse') {
    // 절 입력 모드: 절 입력이 있으면 해당 절로, 없으면 그냥 닫기
    const verse = parseInt(verseInput.value, 10);
    if (verse > 0) {
      confirmAndClose(verse);
    } else {
      confirmAndClose();
    }
  }
};

// Center within this column only; viewport-relative differences cancel sheet
// translation and existing scrollTop. Never move the reader or sheet ancestors.
const centerInContainer = (container: HTMLElement | null, selector: string) => {
  const target = container?.querySelector<HTMLElement>(selector);
  if (!container || !target) return;
  const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientTop;
  container.scrollTop = Math.max(0, container.scrollTop + offset - (container.clientHeight - target.getBoundingClientRect().height) / 2);
};

const scrollToSelectedBook = () => {
  centerInContainer(booksSection.value, `[data-id="${selectedBookId.value}"]`);
};

const scrollToSelectedChapter = () => {
  scrollToSearchedChapter(props.currentChapter);
};

const scrollToSearchedChapter = (chapter: number) => {
  centerInContainer(chaptersSection.value, `[data-chapter="${chapter}"]`);
};

// BottomSheet mounts its teleported content after mount. Ref readiness also
// covers an initially-open selector, without waiting for a guessed animation.
watch([booksSection, chaptersSection], () => {
  if (props.modelValue) {
    scrollToSelectedBook();
    scrollToSelectedChapter();
  }
}, { flush: 'post' });
</script>

<style scoped>
/* The shared sheet teleports its dialog; anchor overrides to this consumer. */
:global(.bottom-sheet.book-selector-sheet) {
  height: 88dvh;
  max-height: 88dvh;
  padding: 0 0 env(safe-area-inset-bottom);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
}

:global(.book-selector-sheet .bottom-sheet__header) {
  padding: 12px 20px;
}

:global(.book-selector-sheet .bottom-sheet__content) {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

button:focus-visible {
  outline: 3px solid var(--color-accent-primary);
  outline-offset: -3px;
}

/* 역본 선택 슬라이드 */
.version-slide-section {
  flex-shrink: 0; /* 고정, 스크롤 안 됨 */
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border-default);
  background-color: var(--color-bg-card);
  transition: background-color 0.2s, border-color 0.2s;
}

.version-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 1rem;
}

.version-row.secondary {
  margin-top: 0.5rem;
}

.version-row-label {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.version-scroll-container {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  /* 스크롤 가장자리 블러 페이드 (왼쪽은 미세하게, 오른쪽만 넓게) */
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 4px, #000 calc(100% - 20px), transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, #000 4px, #000 calc(100% - 20px), transparent 100%);
}

.version-scroll-container::-webkit-scrollbar {
  display: none;
}

/* 역본 비교 토글 — 칩 기본 형태 + 켜짐 상태만 액센트 아웃라인 */
.compare-toggle.is-on {
  color: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
  background: color-mix(in srgb, var(--color-accent-primary) 8%, transparent);
}

.version-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  min-height: var(--hit-min);
  border-radius: var(--radius-pill);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-default);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.version-chip:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border-default);
}

.version-chip:active {
  transform: scale(0.98);
}

.version-chip.active {
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-accent-primary);
  box-shadow: var(--shadow-sm);
}

/* 검색 섹션 */
.search-section {
  flex-shrink: 0; /* 고정, 스크롤 안 됨 */
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border-default);
  transition: border-color 0.2s;
}

/* 선택 상태 표시 */
.selection-status {
  margin-bottom: 0.5rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: var(--color-accent-primary-light);
  color: var(--color-accent-primary);
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.status-badge:hover {
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--color-text-tertiary);
  pointer-events: none;
  transition: color 0.2s;
}

.input-prefix {
  position: absolute;
  left: 0.75rem;
  color: var(--color-accent-primary);
  font-size: 0.875rem;
  font-weight: 500;
  pointer-events: none;
}

.search-input {
  box-sizing: border-box;
  width: 100%;
  height: var(--hit-min);
  padding: 0.625rem 2.75rem 0.625rem 2.5rem;
  border: 1px solid var(--color-border-default);
  border-radius: 12px;
  font-size: 0.9375rem;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  transition: all 0.2s ease;
}

.search-input.numeric-input {
  padding-left: 2rem;
  padding-right: 6rem;
  font-size: 1.125rem;
  font-weight: 500;
  letter-spacing: 0.025em;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
  background: var(--color-bg-card);
  box-shadow: 0 0 0 3px var(--color-accent-focus-ring);
}

.search-input.input-error {
  border-color: var(--color-error);
  animation: shake 0.3s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.search-clear-button {
  position: absolute;
  right: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--hit-min);
  height: var(--hit-min);
  background: none;
  border: none;
  padding: 0.25rem;
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
}

.numeric-input ~ .search-clear-button {
  right: calc(var(--hit-min) + 0.5rem);
}

.search-submit-button {
  position: absolute;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--hit-min);
  height: var(--hit-min);
  border: none;
  border-radius: 8px;
  color: var(--color-text-inverse);
  background: var(--color-accent-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.search-submit-button:hover {
  background: var(--color-accent-primary-hover);
}

.search-submit-button:active {
  transform: scale(0.96);
}

.search-clear-button:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

/* 입력 힌트 */
.input-hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
}

/* 검색 결과 미리보기 */
.search-result-preview {
  margin-top: 0.75rem;
}

.ai-result-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--color-accent-primary);
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.ai-sparkle {
  color: var(--color-accent-primary);
}

.search-results-list {
  display: flex;
  flex-wrap: wrap;
  max-height: 108px;
  overflow-y: auto;
  overscroll-behavior: contain;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}

.search-result-item {
  min-height: var(--hit-min);
  border-radius: var(--radius-pill);
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-primary);
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.search-result-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border-default);
}

.search-result-item.selected {
  border-color: var(--color-accent-primary);
  background: var(--color-accent-primary-light);
  color: var(--color-accent-primary);
}

.search-result-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 10px;
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
}

.search-result-button:hover {
  background: var(--color-accent-primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-card-hover);
}

.search-result-button:active {
  transform: translateY(0);
}

.result-book {
  font-weight: 600;
}

.result-chapter,
.result-verse {
  font-weight: 400;
}

.result-hint {
  font-size: 0.8125rem;
  opacity: 0.8;
}

.result-action {
  margin-left: auto;
  font-size: 0.8125rem;
  opacity: 0.9;
}

.result-arrow {
  flex-shrink: 0;
}

/* Independent 7:3 columns fill the sheet below fixed search controls. */
.modal-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background-color: var(--color-bg-card);
}

/* 책 섹션 */
.books-section {
  flex: 7;
  min-width: 0;
  min-height: 0; /* flex 자식 스크롤 가능 */
  border-right: 1px solid var(--color-border-default);
  overflow-y: auto;
  overscroll-behavior: contain;
  transition: border-color 0.2s;
}

.testament-group {
  /* 구약/신약 그룹 */
}

.testament-header {
  position: sticky;
  top: 0;
  padding: 0.625rem 1rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background-color: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border-default);
}

.books-list {
  display: flex;
  flex-direction: column;
}

.book-item {
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--hit-min);
  min-height: var(--hit-min);
  padding: 0 1rem;
  border: none;
  border-bottom: 1px solid var(--color-border-default);
  background: transparent;
  color: var(--color-text-primary);
  font-size: 0.9375rem;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.book-item:last-child {
  border-bottom: none;
}

.book-item:hover {
  background-color: var(--color-bg-hover);
}

.book-item.active {
  background-color: var(--color-accent-primary-light);
  color: var(--color-accent-primary);
  font-weight: 700;
}

.book-name {
  flex: 1;
}

/* 장 섹션 */
.chapters-section {
  flex: 3;
  min-width: 0;
  min-height: 0; /* flex 자식 스크롤 가능 */
  overflow-y: auto;
  overscroll-behavior: contain;
  background-color: var(--color-bg-primary);
}

.chapters-list {
  display: flex;
  flex-direction: column;
}

.chapter-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--hit-min);
  min-height: var(--hit-min);
  padding: 0 0.5rem;
  border: none;
  border-bottom: 1px solid var(--color-border-default);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.chapter-item:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.chapter-item.read {
  color: var(--color-text-primary);
}

.chapter-item.active {
  background-color: var(--color-accent-primary);
  color: var(--color-text-inverse);
  font-weight: 500;
}

.chapter-item.searched:not(.active) {
  background-color: var(--color-accent-primary-light);
  color: var(--color-accent-primary);
}

.chapter-num {
  font-variant-numeric: tabular-nums;
}

/* Mobile Responsive */
@media (max-width: 480px) {
  .book-item {
    padding: 0 0.875rem;
    font-size: 0.875rem;
  }

  .chapter-item {
    padding: 0 0.375rem;
    font-size: 0.8125rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition: none;
    animation: none;
  }
}
</style>
