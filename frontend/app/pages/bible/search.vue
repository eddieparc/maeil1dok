<template>
  <BibleSubpageLayout title="본문 검색">
    <section class="search-panel">
      <div class="search-hero">
        <span class="search-kicker">Bible Search</span>
        <h2>성경 본문을 빠르게 찾아보세요</h2>
        <p>단어를 입력하면 역본과 책별로 정리해서 보여드립니다.</p>
        <div class="search-tips" aria-label="검색 도움말">
          <span>두 글자 이상</span>
          <span>/ 키로 바로 입력</span>
          <span>결과 탭하면 해당 절로 이동</span>
        </div>
      </div>

      <div class="search-controls">
        <label class="version-select">
          <select v-model="version" aria-label="역본 선택">
            <option value="">전체 역본</option>
            <option
              v-for="option in versionOptions"
              :key="option.code"
              :value="option.code"
            >
              {{ option.name }}
            </option>
          </select>
          <ChevronDownIcon :size="16" aria-hidden="true" />
        </label>
        <div class="search-field">
          <SearchIcon class="search-field-icon" :size="18" />
          <input
            ref="searchInputRef"
            v-model.trim="query"
            type="search"
            enterkeyhint="search"
            placeholder="본문 단어를 입력하세요"
            @keydown.enter.prevent="search"
          >
          <button class="search-button" type="button" :disabled="isSearching" aria-label="검색" @click="search">
            <SearchIcon :size="18" />
            <span>{{ isSearching ? '검색 중' : '검색' }}</span>
          </button>
        </div>
      </div>
      <p v-if="message" class="message error-message">{{ message }}</p>
      <p v-else-if="resultSummary" class="message">{{ resultSummary }}</p>
    </section>

    <section class="results-section" aria-live="polite">
      <div v-if="!hasSearched" class="empty-state">
        <SearchIcon :size="30" aria-hidden="true" />
        <strong>찾고 싶은 말씀의 단어를 입력하세요</strong>
        <span>예: 사랑, 믿음, 평안</span>
      </div>
      <div v-else-if="results.length === 0 && !isSearching" class="empty-state">
        <SearchIcon :size="30" aria-hidden="true" />
        <strong>검색 결과가 없습니다</strong>
        <span>다른 단어나 전체 역본으로 다시 검색해보세요.</span>
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
          @click="toggleGroup(group.book)"
        >
          <span class="result-group-title">{{ bookLabel(group.book) }}</span>
          <span class="result-group-count">{{ group.results.length }}개</span>
          <ChevronDownIcon class="result-group-icon" :class="{ expanded: isGroupExpanded(group.book) }" :size="18" />
        </button>
        <div v-if="isGroupExpanded(group.book)" class="result-group-body">
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ChevronDownIcon, SearchIcon } from '@lucide/vue';
import type { paths } from '~/types/generated/api-schema';
import { useApi } from '~/composables/useApi';
import { useBibleData } from '~/composables/useBibleData';
import BibleSubpageLayout from '~/components/bible/BibleSubpageLayout.vue';
import {
  highlightBibleSearchSnippet,
} from '~/utils/bibleSearchSnippet';
import { buildBibleSearchResultQuery } from '~/utils/bibleSearchRoute';
import '~/assets/css/bible-search.css';

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
const results = ref<readonly SearchResult[]>([]);
const expandedBooks = ref<ReadonlySet<string>>(new Set());
const message = ref('');
const isSearching = ref(false);
const hasSearched = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

// 백엔드는 역본 코드를 열거형으로 받는다(OpenAPI 계약). UI 상태는 문자열이므로
// 호출 경계에서 좁힌다 — 알 수 없는 값은 보내지 않고 서버 기본값에 맡긴다.
// 계약이 바뀌면 이 타입이 따라 바뀌고 여기서 타입 오류로 드러난다.
type BibleVersion = NonNullable<
  NonNullable<paths['/api/v1/bible-cache/search/']['get']['parameters']['query']>['version']
>;

const BIBLE_VERSIONS = new Set<string>([
  'ASV', 'COG', 'COGNEW', 'GAE', 'GRK', 'HAN', 'HEB',
  'KJV', 'KNT', 'SAE', 'SAENEW', 'WEB', 'WOORI',
] satisfies BibleVersion[]);

function toBibleVersion(value: string): BibleVersion | undefined {
  return BIBLE_VERSIONS.has(value) ? (value as BibleVersion) : undefined;
}

const versionOptions = computed(() =>
  Object.entries(versionNames).map(([code, name]) => ({ code, name }))
);

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
  if (query.value.length < 2) {
    message.value = '검색어는 두 글자 이상 입력해주세요.';
    results.value = [];
    expandedBooks.value = new Set();
    return;
  }

  isSearching.value = true;
  message.value = '';
  hasSearched.value = true;

  try {
    const response = await api.GET('/api/v1/bible-cache/search/', {
      params: {
        q: query.value,
        version: toBibleVersion(version.value),
      },
    });
    const data = parseSearchResponse(response.data);
    results.value = data.results || [];
    initializeExpandedGroups();
  } catch (error) {
    message.value = error instanceof Error ? error.message : '검색에 실패했습니다.';
    results.value = [];
    expandedBooks.value = new Set();
  } finally {
    isSearching.value = false;
  }
};

const resultUrl = (result: SearchResult) => ({
  path: '/bible',
  query: buildBibleSearchResultQuery(result, query.value),
});

const versionLabel = (code: string): string => versionNames[code] || code;
const bookLabel = (book: string): string => bookNames[book] || book;
const chapterSuffix = (book: string): string => getChapterUnit(book);
const highlightSnippet = (snippet: string): string =>
  highlightBibleSearchSnippet(snippet, query.value);

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
  window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>
