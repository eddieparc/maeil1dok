<template>
  <BibleSubpageLayout title="본문 검색">
    <section class="search-panel">
      <div class="search-controls">
        <label class="search-field">
          <SearchIcon :size="18" />
          <input
            ref="searchInputRef"
            v-model.trim="query"
            type="search"
            enterkeyhint="search"
            placeholder="본문 단어를 입력하세요"
            @keydown.enter.prevent="search"
          >
        </label>
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
        <button class="search-button" type="button" :disabled="isSearching" @click="search">
          <SearchIcon :size="18" />
          <span>{{ isSearching ? '검색 중' : '검색' }}</span>
        </button>
      </div>
      <p v-if="message" class="message">{{ message }}</p>
    </section>

    <section class="results-section" aria-live="polite">
      <p v-if="!hasSearched" class="empty-state">
        검색어를 입력하세요.
      </p>
      <p v-else-if="results.length === 0 && !isSearching" class="empty-state">
        검색 결과가 없습니다.
      </p>
      <NuxtLink
        v-for="result in results"
        :key="`${result.version}-${result.book}-${result.chapter}`"
        class="result-card"
        :to="resultUrl(result)"
      >
        <div class="result-meta">
          <span>{{ versionLabel(result.version) }}</span>
          <strong>
            {{ bookLabel(result.book) }} {{ result.chapter }}{{ chapterSuffix(result.book) }}
            <template v-if="result.verse"> {{ result.verse }}절</template>
          </strong>
        </div>
        <p v-html="highlightSnippet(result.snippet)"></p>
      </NuxtLink>
    </section>
  </BibleSubpageLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { SearchIcon } from '@lucide/vue';
import { useApi } from '~/composables/useApi';
import { useBibleData } from '~/composables/useBibleData';
import BibleSubpageLayout from '~/components/bible/BibleSubpageLayout.vue';
import '~/assets/css/bible-search.css';

type SearchResult = {
  readonly version: string;
  readonly book: string;
  readonly chapter: number;
  readonly verse?: number | null;
  readonly snippet: string;
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
const message = ref('');
const isSearching = ref(false);
const hasSearched = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

const versionOptions = computed(() =>
  Object.entries(versionNames).map(([code, name]) => ({ code, name }))
);

const search = async (): Promise<void> => {
  if (query.value.length < 2) {
    message.value = '검색어는 두 글자 이상 입력해주세요.';
    results.value = [];
    return;
  }

  isSearching.value = true;
  message.value = '';
  hasSearched.value = true;

  try {
    const response = await api.get('/api/v1/bible-cache/search/', {
      params: {
        q: query.value,
        version: version.value || undefined,
      },
    });
    const data = parseSearchResponse(response.data);
    results.value = data.results || [];
    message.value = `${data.count || 0}개 결과`;
  } catch (error) {
    message.value = error instanceof Error ? error.message : '검색에 실패했습니다.';
    results.value = [];
  } finally {
    isSearching.value = false;
  }
};

const resultUrl = (result: SearchResult) => ({
  path: '/bible',
  query: {
    book: result.book,
    chapter: String(result.chapter),
    version: result.version,
    verse: result.verse ? String(result.verse) : undefined,
    search: query.value,
  },
});

const versionLabel = (code: string): string => versionNames[code] || code;
const bookLabel = (book: string): string => bookNames[book] || book;
const chapterSuffix = (book: string): string => getChapterUnit(book);
const sanitizeSnippet = (snippet: string): string =>
  decodeHtmlEntities(snippet)
    .replace(/\s*직접입력\s*\[[^\]]+\]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const decodeHtmlEntities = (value: string): string => {
  if (typeof document === 'undefined') return value.replace(/&nbsp;/g, ' ');

  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightSnippet = (snippet: string): string => {
  const cleaned = sanitizeSnippet(snippet);
  const escaped = escapeHtml(cleaned);
  if (!query.value) return escaped;

  return escaped.replace(
    new RegExp(`(${escapeRegExp(escapeHtml(query.value))})`, 'gi'),
    '<mark class="search-hit">$1</mark>'
  );
};

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
