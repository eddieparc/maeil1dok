<template>
  <BibleSubpageLayout title="본문 검색" class="bible-search-page">
    <section class="search-panel">
      <div class="search-controls">
        <div ref="versionPopoverRef" class="version-select" @focusout="handleVersionFocusout">
          <button
            ref="versionTriggerRef"
            class="version-trigger"
            type="button"
            :aria-label="`역본 선택: ${versionLabel(version)}`"
            aria-haspopup="listbox"
            :aria-expanded="isVersionOpen"
            :aria-controls="isVersionOpen ? 'search-version-listbox' : undefined"
            @click="toggleVersionPopover"
            @keydown="handleVersionTriggerKeydown"
          >
            <span>{{ versionLabel(version) }}</span>
            <ChevronDownIcon :size="16" aria-hidden="true" />
          </button>
          <div
            v-if="isVersionOpen"
            id="search-version-listbox"
            ref="versionListRef"
            class="version-listbox"
            role="listbox"
            aria-label="역본 선택"
            @keydown="handleVersionListKeydown"
          >
            <button
              v-for="(option, index) in versionChoices"
              :key="option.code"
              class="version-option"
              type="button"
              role="option"
              :value="option.code"
              :aria-selected="version === option.code"
              :tabindex="activeVersionIndex === index ? 0 : -1"
              @focus="activeVersionIndex = index"
              @click="selectVersion(option.code)"
            >
              <span>{{ option.name }}</span>
              <CheckIcon v-if="version === option.code" :size="16" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div class="search-field">
          <input
            ref="searchInputRef"
            v-model.trim="query"
            type="search"
            enterkeyhint="search"
            placeholder="본문 단어를 입력하세요"
            aria-label="검색어"
            :aria-invalid="Boolean(message)"
            :aria-describedby="message ? 'search-error' : undefined"
            @keydown.enter.prevent="search"
          >
          <button v-if="query" class="clear-search icon-button" type="button" aria-label="검색어 지우기" @click="clearSearch">
            <XIcon :size="18" aria-hidden="true" />
          </button>
        </div>
        <button class="search-button icon-button" type="button" :disabled="isSearching" :aria-label="isSearching ? '검색 중' : '검색'" @click="search">
          <LoaderCircleIcon v-if="isSearching" class="search-spinner" :size="20" aria-hidden="true" />
          <SearchIcon v-else :size="20" aria-hidden="true" />
        </button>
      </div>
      <p v-if="message" id="search-error" class="message error-message" role="alert">{{ message }}</p>
      <p v-else-if="resultSummary" class="message" role="status">{{ resultSummary }}</p>
      <p v-if="storageMessage" class="message storage-message" role="status">{{ storageMessage }}</p>
    </section>

    <section class="results-section" aria-live="polite" :aria-busy="isSearching">
      <SkeletonList v-if="isSearching && results.length === 0" :count="5" variant="bookmark" />
      <template v-else-if="!hasSearched">
        <div class="empty-state">
          <span class="empty-icon"><SearchIcon :size="28" aria-hidden="true" /></span>
          <strong>찾고 싶은 말씀의 단어를 입력하세요</strong>
          <span>한 글자부터 검색 가능 · 결과를 탭하면 해당 절로 이동해요</span>
        </div>
        <section class="search-suggestions" aria-labelledby="recommended-heading">
          <h2 id="recommended-heading">추천 검색어</h2>
          <div class="recommended-terms">
            <button v-for="term in recommendedTerms" :key="term" class="recommended-term" type="button" @click="searchTerm(term)">{{ term }}</button>
          </div>
        </section>
        <section v-if="recentSearches.length" class="search-suggestions" aria-labelledby="recent-heading">
          <div class="recent-heading">
            <h2 id="recent-heading">최근 검색</h2>
            <button class="clear-recent" type="button" @click="clearRecentSearches">지우기</button>
          </div>
          <ul class="recent-list">
            <li v-for="recent in recentSearches" :key="`${recent.version}-${recent.query}`">
              <button class="recent-search" type="button" @click="searchTerm(recent.query, recent.version)">
                <ClockIcon :size="18" aria-hidden="true" />
                <span class="recent-query">{{ recent.query }}</span>
                <span class="recent-version">{{ versionLabel(recent.version) }}</span>
              </button>
            </li>
          </ul>
        </section>
      </template>
      <div v-else-if="results.length === 0 && !isSearching && !message" class="empty-state">
        <span class="empty-icon"><SearchIcon :size="28" aria-hidden="true" /></span>
        <strong>‘{{ submittedQuery }}’ 검색 결과가 없어요</strong>
        <span>다른 단어로 다시 검색해보세요.</span>
        <button v-if="version" class="search-all-versions" type="button" @click="searchAllVersions">전체 역본으로 검색</button>
      </div>
      <div
        v-for="group in groupedResults"
        :key="group.book"
        class="result-group"
      >
        <button
          class="result-group-header"
          type="button"
          :aria-expanded="isGroupExpanded(group.book)"
          :aria-controls="`search-results-${group.book}`"
          @click="toggleGroup(group.book)"
        >
          <span class="result-group-title">{{ bookLabel(group.book) }}</span>
          <span class="result-group-count">{{ group.results.length }}개</span>
          <ChevronDownIcon class="result-group-icon" :class="{ expanded: isGroupExpanded(group.book) }" :size="18" aria-hidden="true" />
        </button>
        <div v-if="isGroupExpanded(group.book)" :id="`search-results-${group.book}`" class="result-group-body">
          <NuxtLink
            v-for="result in group.results"
            :key="`${result.version}-${result.book}-${result.chapter}-${result.verse ?? 'chapter'}`"
            class="result-card"
            :to="resultUrl(result)"
          >
            <div class="result-meta">
              <span>{{ versionLabel(result.version) }}</span>
              <strong>
                {{ result.chapter }}{{ chapterSuffix(result.book) }}
                <template v-if="result.verse"> {{ result.verse }}절</template>
              </strong>
            </div>
            <p v-html="highlightSnippet(result.snippet)"></p>
          </NuxtLink>
        </div>
      </div>
    </section>
  </BibleSubpageLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { CheckIcon, ChevronDownIcon, ClockIcon, LoaderCircleIcon, SearchIcon, XIcon } from '@lucide/vue';
import type { paths } from '~/types/generated/api-schema';
import { useApi } from '~/composables/useApi';
import { useBibleData, VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';
import BibleSubpageLayout from '~/components/bible/BibleSubpageLayout.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';
import {
  highlightBibleSearchSnippet,
} from '~/utils/bibleSearchSnippet';
import { buildBibleSearchResultQuery } from '~/utils/bibleSearchRoute';

type SearchResult = {
  readonly version: string;
  readonly book: string;
  readonly chapter: number;
  readonly verse?: number | null;
  readonly snippet: string;
};

type SearchResultGroup = {
  readonly book: string;
  readonly results: readonly SearchResult[];
};

type SearchResponse = {
  readonly success: boolean;
  readonly count?: number;
  readonly results?: readonly SearchResult[];
  readonly error?: string;
};

const api = useApi();
const { bookNames, versionNames, getChapterUnit } = useBibleData();
const query = ref('');
const version = ref('GAE');
const isVersionOpen = ref(false);
const activeVersionIndex = ref(0);
const versionPopoverRef = ref<HTMLElement | null>(null);
const versionTriggerRef = ref<HTMLButtonElement | null>(null);
const versionListRef = ref<HTMLElement | null>(null);
const results = ref<readonly SearchResult[]>([]);
const expandedBooks = ref<ReadonlySet<string>>(new Set());
const message = ref('');
const isSearching = ref(false);
const hasSearched = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);
const submittedQuery = ref('');
const recommendedTerms = ['사랑', '믿음', '평안', '빛', '소망'];
type RecentSearch = { query: string; version: string };
const RECENT_SEARCHES_KEY = 'bible_recent_searches';
const recentSearches = ref<RecentSearch[]>([]);
const storageMessage = ref('');
let requestId = 0;

// 백엔드는 역본 코드를 열거형으로 받는다(OpenAPI 계약). UI 상태는 문자열이므로
// 호출 경계에서 좁힌다 — 알 수 없는 값은 보내지 않고 서버 기본값에 맡긴다.
// 계약이 바뀌면 이 타입이 따라 바뀌고 여기서 타입 오류로 드러난다.
type BibleVersion = NonNullable<
  NonNullable<paths['/api/v1/bible-cache/search/']['get']['parameters']['query']>['version']
>;

const BIBLE_VERSIONS = new Set<string>([
  'ASV', 'COG', 'COGNEW', 'GAE', 'GRK', 'HAN', 'HEB',
  'KJV', 'KNT', 'SAE', 'SAENEW', 'WEB',
] satisfies BibleVersion[]);

function toBibleVersion(value: string): BibleVersion | undefined {
  return BIBLE_VERSIONS.has(value) ? (value as BibleVersion) : undefined;
}

// 검색은 캐시된 본문만 대상으로 하므로, 서비스가 실제로 제공하는 역본
// (VISIBLE_VERSION_NAMES)만 선택지에 둔다. 미지원 역본을 노출하면
// 항상 0건이 나오는 죽은 옵션이 된다.
const versionOptions = computed(() =>
  Object.entries(VISIBLE_VERSION_NAMES).map(([code, name]) => ({ code, name }))
);

const versionChoices = computed(() => [{ code: '', name: '전체 역본' }, ...versionOptions.value]);

const focusVersionOption = (index: number): void => {
  activeVersionIndex.value = index;
  versionListRef.value?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]?.focus();
};

const openVersionPopover = async (edge?: 'Home' | 'End'): Promise<void> => {
  activeVersionIndex.value = edge === 'Home' ? 0 : edge === 'End' ? versionChoices.value.length - 1
    : Math.max(0, versionChoices.value.findIndex(option => option.code === version.value));
  isVersionOpen.value = true;
  await nextTick();
  if (isVersionOpen.value) focusVersionOption(activeVersionIndex.value);
};

const closeVersionPopover = (returnFocus = true): void => {
  isVersionOpen.value = false;
  if (returnFocus) versionTriggerRef.value?.focus();
};

const toggleVersionPopover = (): Promise<void> | void => {
  if (isVersionOpen.value) closeVersionPopover();
  else return openVersionPopover();
};

const handleVersionTriggerKeydown = (event: KeyboardEvent): Promise<void> | void => {
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    return openVersionPopover(event.key === 'Home' || event.key === 'End' ? event.key : undefined);
  }
};

const handleVersionListKeydown = (event: KeyboardEvent): Promise<void> | void => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeVersionPopover();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const option = versionChoices.value[activeVersionIndex.value];
    if (option) return selectVersion(option.code);
  } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const last = versionChoices.value.length - 1;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? last
      : Math.min(last, Math.max(0, activeVersionIndex.value + (event.key === 'ArrowDown' ? 1 : -1)));
    focusVersionOption(index);
  }
};

const handleVersionPointerdown = (event: PointerEvent): void => {
  if (isVersionOpen.value && !versionPopoverRef.value?.contains(event.target as Node)) closeVersionPopover();
};

const handleVersionFocusout = (event: FocusEvent): void => {
  if (!versionPopoverRef.value?.contains(event.relatedTarget as Node | null)) closeVersionPopover(false);
};

const selectVersion = (code: string): Promise<void> | undefined => {
  closeVersionPopover();
  if (version.value === code) return;
  version.value = code;
  return handleVersionChange();
};

const groupedResults = computed<readonly SearchResultGroup[]>(() => {
  const groups = new Map<string, SearchResult[]>();

  for (const result of results.value) {
    const group = groups.get(result.book) || [];
    group.push(result);
    groups.set(result.book, group);
  }

  return Array.from(groups.entries()).map(([book, groupResults]) => ({
    book,
    results: groupResults,
  }));
});

const resultSummary = computed(() => {
  if (!hasSearched.value || isSearching.value || results.value.length === 0) return '';
  return `${results.value.length}개 결과 · ${groupedResults.value.length}권`;
});

const isGroupExpanded = (book: string): boolean => expandedBooks.value.has(book);

const toggleGroup = (book: string): void => {
  const next = new Set(expandedBooks.value);
  if (next.has(book)) {
    next.delete(book);
  } else {
    next.add(book);
  }
  expandedBooks.value = next;
};

const initializeExpandedGroups = (): void => {
  const firstBook = groupedResults.value[0]?.book;
  expandedBooks.value = firstBook ? new Set([firstBook]) : new Set();
};

const search = async (): Promise<void> => {
  const id = ++requestId;
  const term = query.value.trim();
  if (!term) {
    message.value = '검색어를 입력해주세요.';
    results.value = [];
    expandedBooks.value = new Set();
    hasSearched.value = false;
    isSearching.value = false;
    return;
  }

  query.value = term;
  const selectedVersion = version.value;
  rememberSearch({ query: term, version: selectedVersion });
  isSearching.value = true;
  message.value = '';
  hasSearched.value = true;

  try {
    const response = await api.GET('/api/v1/bible-cache/search/', {
      params: {
        q: term,
        version: toBibleVersion(selectedVersion),
      },
    });
    if (id !== requestId) return;
    const data = parseSearchResponse(response.data);
    if (!data.success) throw new Error(data.error || '검색에 실패했습니다. 다시 시도해주세요.');
    submittedQuery.value = term;
    results.value = data.results || [];
    initializeExpandedGroups();
  } catch (error) {
    if (id !== requestId) return;
    message.value = error instanceof Error ? error.message : '검색에 실패했습니다.';
    results.value = [];
    expandedBooks.value = new Set();
  } finally {
    if (id === requestId) isSearching.value = false;
  }
};

const handleVersionChange = (): Promise<void> | undefined => {
  if (hasSearched.value) return search();
};

const searchTerm = (term: string, selectedVersion = version.value): Promise<void> => {
  query.value = term;
  version.value = selectedVersion;
  return search();
};

const searchAllVersions = (): Promise<void> => searchTerm(submittedQuery.value, '');

const clearSearch = (): void => {
  ++requestId;
  query.value = '';
  submittedQuery.value = '';
  results.value = [];
  expandedBooks.value = new Set();
  message.value = '';
  isSearching.value = false;
  hasSearched.value = false;
  focusSearchInput();
};

const rememberSearch = (recent: RecentSearch): void => {
  recentSearches.value = [recent, ...recentSearches.value.filter(
    item => item.query !== recent.query || item.version !== recent.version,
  )].slice(0, 5);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches.value));
    storageMessage.value = '';
  } catch {
    storageMessage.value = '최근 검색을 이 기기에 저장하지 못했어요.';
  }
};

const loadRecentSearches = (): void => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return;
    const items: unknown = JSON.parse(stored);
    if (!Array.isArray(items)) throw new Error('Invalid search history');
    const restored: RecentSearch[] = [];
    for (const item of items) {
      if (!isRecord(item) || typeof item.query !== 'string' || !item.query.trim() ||
        typeof item.version !== 'string' || (item.version !== '' && !toBibleVersion(item.version))) continue;
      const recent = { query: item.query.trim(), version: item.version };
      if (!restored.some(value => value.query === recent.query && value.version === recent.version)) restored.push(recent);
      if (restored.length === 5) break;
    }
    recentSearches.value = restored;
  } catch {
    storageMessage.value = '최근 검색을 불러오지 못했어요. 검색은 계속할 수 있어요.';
  }
};

const clearRecentSearches = (): void => {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    recentSearches.value = [];
    storageMessage.value = '';
  } catch {
    storageMessage.value = '최근 검색을 지우지 못했어요. 다시 시도해주세요.';
  }
};

const resultUrl = (result: SearchResult) => ({
  path: '/bible',
  query: buildBibleSearchResultQuery(result, submittedQuery.value),
});

const versionLabel = (code: string): string => code ? versionNames[code] || code : '전체 역본';
const bookLabel = (book: string): string => bookNames[book] || book;
const chapterSuffix = (book: string): string => getChapterUnit(book);
const highlightSnippet = (snippet: string): string =>
  highlightBibleSearchSnippet(snippet, submittedQuery.value);

const focusSearchInput = (): void => {
  searchInputRef.value?.focus();
};

const handleGlobalKeydown = (event: KeyboardEvent): void => {
  if (event.key !== '/') return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return;
  }

  event.preventDefault();
  focusSearchInput();
};

const parseSearchResponse = (value: unknown): SearchResponse => {
  if (!isRecord(value)) {
    return { success: false, results: [], error: 'Invalid response' };
  }

  const rawResults = Array.isArray(value.results) ? value.results : [];
  return {
    success: value.success === true,
    count: typeof value.count === 'number' ? value.count : rawResults.length,
    results: rawResults.filter(isSearchResult),
    error: typeof value.error === 'string' ? value.error : undefined,
  };
};

const isSearchResult = (value: unknown): value is SearchResult =>
  isRecord(value) &&
  typeof value.version === 'string' &&
  typeof value.book === 'string' &&
  typeof value.chapter === 'number' &&
  (typeof value.verse === 'number' || value.verse === null || value.verse === undefined) &&
  typeof value.snippet === 'string';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

onMounted(() => {
  loadRecentSearches();
  window.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('pointerdown', handleVersionPointerdown);
});

onBeforeUnmount(() => {
  ++requestId;
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('pointerdown', handleVersionPointerdown);
});
</script>

<style scoped>
.search-panel,
.results-section {
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  letter-spacing: var(--tracking-body);
}

.bible-search-page :deep(.bible-back-btn) { min-width: var(--hit-min); min-height: var(--hit-min); }
.search-panel { padding: 6px var(--screen-gutter) 12px; }
.search-controls { display: flex; align-items: center; gap: 8px; }
.search-field,
.version-select {
  display: flex;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-pill);
  background: var(--color-bg-secondary);
}
.search-field { flex: 1; }
.version-select { position: relative; flex: 0 1 120px; border-radius: 14px; }
.version-trigger svg { flex-shrink: 0; color: var(--color-text-secondary); }
.search-field input,
.version-trigger {
  width: 100%;
  min-width: 0;
  min-height: var(--hit-min);
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  font-size: 14px;
  padding: 0 12px;
}
.version-trigger { display: flex; align-items: center; justify-content: space-between; gap: 8px; text-align: left; }
.version-trigger span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.version-listbox {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 10;
  width: 220px;
  max-width: calc(100vw - 2 * var(--screen-gutter));
  max-height: min(320px, 50dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px;
  border: 1px solid var(--color-border-default);
  border-radius: 14px;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-card);
}
.version-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: var(--hit-min);
  padding: 8px 12px;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-primary);
  text-align: left;
  font-size: 14px;
}
.version-option svg { flex-shrink: 0; }
.version-option[aria-selected="true"] { background: var(--color-accent-bg); color: var(--color-accent-primary); font-weight: 700; }
.version-option:hover { background: var(--color-accent-bg); }
.version-trigger:focus-visible,
.version-option:focus-visible { outline: 2px solid var(--color-accent-primary); outline-offset: -2px; }
.search-field input::placeholder { color: var(--color-text-tertiary); }
.search-field input::-webkit-search-cancel-button { appearance: none; }
.search-field:focus-within,
.version-select:focus-within { border-color: var(--color-accent-primary); }
button { cursor: pointer; font: inherit; }
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--hit-min);
  height: var(--hit-min);
  border: 0;
  border-radius: var(--radius-pill);
}
.clear-search { background: transparent; color: var(--color-text-secondary); }
.search-button { background: var(--color-accent-primary); color: var(--color-text-inverse); }
.search-button:hover:not(:disabled) { background: var(--color-accent-primary-hover); }
button:disabled { opacity: .5; cursor: not-allowed; }
button:active:not(:disabled),
.result-card:active { transform: scale(.97); }
.message { margin: 12px 0 0; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
.error-message { color: var(--color-error); }
.results-section { display: grid; gap: 16px; padding: 0 var(--screen-gutter) 32px; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 0 20px; text-align: center; }
.empty-icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: var(--radius-card); background: var(--color-accent-bg); color: var(--color-accent-primary); }
.empty-state strong { font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; }
.empty-state > span:not(.empty-icon) { color: var(--color-text-secondary); font-size: 12px; line-height: 1.5; }
.search-suggestions h2 { margin: 0; font-size: 15px; font-weight: 700; }
.recommended-terms { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.recommended-term,
.search-all-versions {
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  padding: 8px 16px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-pill);
  background: var(--color-bg-secondary);
  color: var(--color-accent-primary);
  font-size: 14px;
  font-weight: 600;
}
.recent-heading { display: flex; align-items: center; justify-content: space-between; }
.clear-recent { min-width: var(--hit-min); min-height: var(--hit-min); border: 0; background: transparent; color: var(--color-text-secondary); font-size: 12px; border-radius: var(--radius-control); }
.recent-list { margin: 0; padding: 0; list-style: none; }
.recent-search { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 12px 0; border: 0; border-bottom: 1px solid var(--color-border-light); background: transparent; color: var(--color-text-secondary); text-align: left; }
.recent-search svg { flex-shrink: 0; }
.recent-query { flex: 1; min-width: 0; color: var(--color-text-primary); font-size: 14px; overflow-wrap: anywhere; }
.recent-version { flex-shrink: 0; font-size: 12px; }
.result-group { border: 1px solid var(--color-border-default); border-radius: 16px; background: var(--color-bg-card); box-shadow: var(--shadow-card); overflow: hidden; }
.result-group-header { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 50px; padding: 12px 16px; border: 0; background: transparent; color: var(--color-text-primary); text-align: left; }
.result-group-title { font-size: 15px; font-weight: 700; }
.result-group-count { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
.result-group-icon { flex-shrink: 0; transition: transform var(--transition-fast); }
.result-group-icon.expanded { transform: rotate(180deg); }
.result-card { display: block; min-height: 56px; padding: 16px; border-top: 1px solid var(--color-border-light); color: var(--color-text-primary); text-decoration: none; }
.result-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-bottom: 8px; font-size: 12px; color: var(--color-text-secondary); }
.result-meta strong { color: var(--color-accent-primary); font-size: 14px; font-weight: 700; }
.result-card p { margin: 0; font-family: 'Noto Serif KR', serif; font-size: 14px; line-height: 1.7; overflow-wrap: anywhere; }
.result-card :deep(.search-hit) { padding: 0 2px; border-radius: var(--radius-cell); background: var(--color-highlight-yellow); color: var(--color-text-primary); font-weight: 700; }
:global([data-theme="dark"] .bible-search-page .search-hit) { color: var(--color-text-inverse); }
.clear-search:hover,
.clear-recent:hover,
.recent-search:hover,
.recommended-term:hover,
.search-all-versions:hover,
.result-group-header:hover,
.result-card:hover { background: var(--color-accent-bg); }
.search-spinner { animation: search-spin 1s linear infinite; }
@keyframes search-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .search-spinner { animation: none; }
  .result-group-icon { transition: none; }
  button:active:not(:disabled), .result-card:active { transform: none; }
}
</style>
