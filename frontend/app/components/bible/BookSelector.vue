<template>
  <UiModalBaseModal
    :model-value="modelValue"
    title="성경 선택"
    size="lg"
    :no-padding="true"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="close"
  >
    <template #header-extra>
      <!-- 검색 입력은 header-extra에 배치하지 않음 -->
    </template>

    <!-- 역본 선택 슬라이드 -->
    <div class="version-slide-section">
      <div class="version-scroll-container">
        <button
          v-for="(name, code) in VISIBLE_VERSION_NAMES"
          :key="code"
          :class="['version-chip', { active: code === currentVersion }]"
          @click="$emit('version-select', String(code))"
        >
          {{ name }}
        </button>
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
            :class="[
              'chapter-item',
              { active: chapter === currentChapter && selectedBookId === currentBook },
              { searched: currentSearchResult && currentSearchResult.chapter === chapter },
            ]"
            @click="selectChapter(chapter)"
          >
            <span class="chapter-num">{{ chapter }}{{ getChapterUnit(selectedBookId) }}</span>
          </button>
        </div>
      </div>
    </div>
  </UiModalBaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useBibleData, type SearchResult, VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';
import SearchIcon from '~/components/icons/SearchIcon.vue';
import XCircleIcon from '~/components/icons/XCircleIcon.vue';
import SparkleIcon from '~/components/icons/SparkleIcon.vue';
import ArrowRightIcon from '~/components/icons/ArrowRightIcon.vue';

const props = defineProps<{
  modelValue: boolean;
  currentBook: string;
  currentChapter: number;
  currentVersion?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'select': [book: string, chapter: number, verse?: number];
  'version-select': [version: string];
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
      if (result.chapter) {
        setTimeout(() => scrollToSearchedChapter(result.chapter!), 50);
      }
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
    searchInputRef.value?.focus();
    scrollToSelectedBook();
  });
};

// 절 입력 모드로 전환
const enterVerseMode = (chapter: number) => {
  confirmedChapter.value = chapter;
  inputMode.value = 'verse';
  verseInput.value = '';
  
  nextTick(() => {
    searchInputRef.value?.focus();
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

  if (result.chapter && result.verse) {
    // 책, 장, 절 모두 있으면 바로 이동
    emit('select', result.bookId, result.chapter, result.verse);
    close();
  } else if (result.chapter) {
    // 책, 장만 있으면 절 입력 모드로
    confirmedBookId.value = result.bookId;
    confirmedBookName.value = result.bookName;
    selectedBookId.value = result.bookId;
    enterVerseMode(result.chapter);
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

// 선택된 책으로 스크롤
const scrollToSelectedBook = () => {
  if (!booksSection.value) return;
  const selectedButton = booksSection.value.querySelector(`[data-id="${selectedBookId.value}"]`);
  if (selectedButton) {
    selectedButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

// 선택된 장으로 스크롤
const scrollToSelectedChapter = () => {
  if (!chaptersSection.value) return;
  const currentChapterButton = chaptersSection.value.querySelector(`[data-chapter="${props.currentChapter}"]`);
  if (currentChapterButton) {
    currentChapterButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

// 검색된 장으로 스크롤
const scrollToSearchedChapter = (chapter: number) => {
  if (!chaptersSection.value) return;
  const chapterButton = chaptersSection.value.querySelector(`[data-chapter="${chapter}"]`);
  if (chapterButton) {
    chapterButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};
</script>

<style scoped>
/* 역본 선택 슬라이드 */
.version-slide-section {
  flex-shrink: 0; /* 고정, 스크롤 안 됨 */
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  background-color: var(--color-bg-card, #fff);
  transition: background-color 0.2s, border-color 0.2s;
}

.version-scroll-container {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0 1rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.version-scroll-container::-webkit-scrollbar {
  display: none;
}

.version-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  background: var(--color-bg-primary, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.version-chip:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
  border-color: var(--color-border, #d1d5db);
}

.version-chip:active {
  transform: scale(0.98);
}

.version-chip.active {
  background: var(--primary-color, #2A1111);
  color: white;
  border-color: var(--primary-color, #2A1111);
  box-shadow: 0 2px 4px rgba(42, 17, 17, 0.2);
}

/* 검색 섹션 */
.search-section {
  flex-shrink: 0; /* 고정, 스크롤 안 됨 */
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
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
  background: var(--primary-light, #eef2ff);
  color: var(--primary-color, #2A1111);
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.status-badge:hover {
  background: var(--primary-color, #2A1111);
  color: white;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--text-tertiary, #9ca3af);
  pointer-events: none;
  transition: color 0.2s;
}

.input-prefix {
  position: absolute;
  left: 0.75rem;
  color: var(--primary-color, #2A1111);
  font-size: 0.875rem;
  font-weight: 500;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.625rem 2.5rem 0.625rem 2.5rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  font-size: 0.9375rem;
  background: var(--color-bg-primary, #f9fafb);
  color: var(--text-primary, #1f2937);
  transition: all 0.2s ease;
}

.search-input.numeric-input {
  padding-left: 2rem;
  padding-right: 4.75rem;
  font-size: 1.125rem;
  font-weight: 500;
  letter-spacing: 0.025em;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color, #2A1111);
  background: var(--color-bg-card, #fff);
  box-shadow: 0 0 0 3px rgba(42, 17, 17, 0.1);
}

.search-input.input-error {
  border-color: #ef4444;
  animation: shake 0.3s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.search-clear-button {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  padding: 0.25rem;
  color: var(--text-tertiary, #9ca3af);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
}

.numeric-input ~ .search-clear-button {
  right: 2.75rem;
}

.search-submit-button {
  position: absolute;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 8px;
  color: white;
  background: var(--primary-color, #2A1111);
  cursor: pointer;
  transition: all 0.2s;
}

.search-submit-button:hover {
  background: var(--primary-hover, #3A1A1A);
}

.search-submit-button:active {
  transform: scale(0.96);
}

.search-clear-button:hover {
  background-color: var(--color-bg-hover, #f3f4f6);
  color: var(--text-secondary, #6b7280);
}

/* 입력 힌트 */
.input-hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary, #9ca3af);
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
  color: var(--primary-color, #2A1111);
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.ai-sparkle {
  color: var(--primary-color, #2A1111);
}

.search-results-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}

.search-result-item {
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  background: var(--color-bg-primary, #f9fafb);
  font-size: 0.8125rem;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
}

.search-result-item:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
  border-color: var(--color-border, #d1d5db);
}

.search-result-item.selected {
  border-color: var(--primary-color, #2A1111);
  background: var(--primary-light, #eef2ff);
  color: var(--primary-color, #2A1111);
}

.search-result-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 10px;
  background: var(--primary-color, #2A1111);
  color: white;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(42, 17, 17, 0.2);
}

.search-result-button:hover {
  background: var(--primary-dark, #3A1A1A);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(42, 17, 17, 0.25);
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

/* 모달 바디 - BaseModal의 .base-modal-body 안에서 flex로 확장 */
.modal-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 300px; /* 최소 높이 보장 */
  overflow: hidden;
  background-color: var(--color-bg-card, #fff);
}

/* 책 섹션 */
.books-section {
  flex: 7;
  min-width: 0;
  min-height: 0; /* flex 자식 스크롤 가능 */
  border-right: 1px solid var(--color-border, #e5e7eb);
  overflow-y: auto;
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
  color: var(--text-tertiary, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background-color: var(--color-bg-secondary, #f9fafb);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.books-list {
  display: flex;
  flex-direction: column;
}

.book-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  border-bottom: 1px solid var(--color-border, #f3f4f6);
  background: transparent;
  color: var(--text-primary, #1f2937);
  font-size: 0.9375rem;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.book-item:last-child {
  border-bottom: none;
}

.book-item:hover {
  background-color: var(--color-bg-hover, #f9fafb);
}

.book-item.active {
  background-color: var(--primary-light, #eef2ff);
  color: var(--primary-color, #2A1111);
  font-weight: 500;
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
  background-color: var(--color-bg-secondary, #f9fafb);
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
  padding: 0.75rem 0.5rem;
  border: none;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  background: transparent;
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.chapter-item:hover {
  background-color: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

.chapter-item.active {
  background-color: var(--primary-color, #2A1111);
  color: white;
  font-weight: 500;
}

.chapter-item.searched:not(.active) {
  background-color: var(--primary-light, #eef2ff);
  color: var(--primary-color, #2A1111);
}

.chapter-num {
  /* 장 번호 */
}

/* Mobile Responsive */
@media (max-width: 480px) {
  .book-item {
    padding: 0.625rem 0.875rem;
    font-size: 0.875rem;
  }

  .chapter-item {
    padding: 0.625rem 0.375rem;
    font-size: 0.8125rem;
  }
}

/* Dark Mode Support */
:root.dark .version-slide-section,
[data-theme="dark"] .version-slide-section {
  background-color: var(--color-bg-card);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

:root.dark .version-chip,
[data-theme="dark"] .version-chip {
  background-color: var(--color-bg-secondary);
  border-color: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

:root.dark .version-chip:hover,
[data-theme="dark"] .version-chip:hover {
  background-color: var(--color-bg-hover);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.15);
}

:root.dark .version-chip.active,
[data-theme="dark"] .version-chip.active {
  background-color: var(--primary-color, #3A1A1A);
  border-color: var(--primary-color, #3A1A1A);
  color: #fff;
}

:root.dark .search-section,
[data-theme="dark"] .search-section {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

:root.dark .status-badge,
[data-theme="dark"] .status-badge {
  background-color: rgba(42, 17, 17, 0.2);
  color: var(--primary-color, #3A1A1A);
}

:root.dark .status-badge:hover,
[data-theme="dark"] .status-badge:hover {
  background-color: var(--primary-color, #3A1A1A);
  color: white;
}

:root.dark .input-prefix,
[data-theme="dark"] .input-prefix {
  color: var(--primary-color, #3A1A1A);
}

:root.dark .search-input,
[data-theme="dark"] .search-input {
  background-color: var(--color-bg-secondary);
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

:root.dark .search-input:focus,
[data-theme="dark"] .search-input:focus {
  background-color: var(--color-bg-card);
  border-color: var(--primary-color, #3A1A1A);
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.2);
}

:root.dark .search-input.input-error,
[data-theme="dark"] .search-input.input-error {
  border-color: #f87171;
}

:root.dark .search-icon,
[data-theme="dark"] .search-icon {
  color: var(--text-tertiary);
}

:root.dark .search-clear-button,
[data-theme="dark"] .search-clear-button {
  color: var(--text-tertiary);
}

:root.dark .search-clear-button:hover,
[data-theme="dark"] .search-clear-button:hover {
  background-color: var(--color-bg-hover);
  color: var(--text-primary);
}

:root.dark .input-hint,
[data-theme="dark"] .input-hint {
  color: var(--text-tertiary);
}

:root.dark .search-result-item,
[data-theme="dark"] .search-result-item {
  background-color: var(--color-bg-secondary);
  border-color: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

:root.dark .search-result-item:hover,
[data-theme="dark"] .search-result-item:hover {
  background-color: var(--color-bg-hover);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.15);
}

:root.dark .search-result-item.selected,
[data-theme="dark"] .search-result-item.selected {
  background-color: rgba(42, 17, 17, 0.2);
  border-color: var(--primary-color, #3A1A1A);
  color: var(--primary-color, #3A1A1A);
}

:root.dark .search-result-button,
[data-theme="dark"] .search-result-button {
  background-color: var(--primary-color, #3A1A1A);
  color: #fff;
}

:root.dark .search-result-button:hover,
[data-theme="dark"] .search-result-button:hover {
  background-color: #2A1111;
}

:root.dark .modal-body,
[data-theme="dark"] .modal-body {
  background-color: var(--color-bg-card);
}

:root.dark .books-section,
[data-theme="dark"] .books-section {
  border-right-color: rgba(255, 255, 255, 0.06);
}

:root.dark .testament-header,
[data-theme="dark"] .testament-header {
  background-color: var(--color-bg-tertiary, #1f2937);
  border-bottom-color: rgba(255, 255, 255, 0.06);
  color: var(--text-tertiary);
}

:root.dark .book-item,
[data-theme="dark"] .book-item {
  color: var(--text-primary);
  border-bottom-color: rgba(255, 255, 255, 0.04);
}

:root.dark .book-item:hover,
[data-theme="dark"] .book-item:hover {
  background-color: var(--color-bg-hover);
}

:root.dark .book-item.active,
[data-theme="dark"] .book-item.active {
  background-color: rgba(42, 17, 17, 0.15);
  color: var(--primary-color, #3A1A1A);
}

:root.dark .chapters-section,
[data-theme="dark"] .chapters-section {
  background-color: var(--color-bg-secondary);
}

:root.dark .chapter-item,
[data-theme="dark"] .chapter-item {
  color: var(--text-secondary);
  border-bottom-color: rgba(255, 255, 255, 0.04);
}

:root.dark .chapter-item:hover,
[data-theme="dark"] .chapter-item:hover {
  background-color: var(--color-bg-hover);
  color: var(--text-primary);
}

:root.dark .chapter-item.active,
[data-theme="dark"] .chapter-item.active {
  background-color: var(--primary-color, #3A1A1A);
  color: #fff;
}

:root.dark .chapter-item.searched:not(.active),
[data-theme="dark"] .chapter-item.searched:not(.active) {
  background-color: rgba(42, 17, 17, 0.15);
  color: var(--primary-color, #3A1A1A);
}

:root.dark .ai-result-label,
[data-theme="dark"] .ai-result-label,
:root.dark .ai-sparkle,
[data-theme="dark"] .ai-sparkle {
  color: var(--primary-color, #3A1A1A);
}
</style>
