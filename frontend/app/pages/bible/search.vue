<template>
  <main class="bible-search-page">
    <header class="search-header">
      <button class="back-button" type="button" aria-label="뒤로가기" @click="goBack">
        <ChevronLeftIcon :size="22" />
      </button>
      <div>
        <p class="eyebrow">캐시 본문</p>
        <h1>성경 본문 검색</h1>
      </div>
    </header>

    <section class="search-panel">
      <div class="search-controls">
        <label class="search-field">
          <SearchIcon :size="18" />
          <input
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
        캐시에 저장된 본문에서 빠르게 찾습니다.
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
          <strong>{{ bookLabel(result.book) }} {{ result.chapter }}{{ chapterSuffix(result.book) }}</strong>
        </div>
        <p>{{ result.snippet }}</p>
      </NuxtLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronLeftIcon, SearchIcon } from '@lucide/vue';
import { useApi } from '~/composables/useApi';
import { useBibleData } from '~/composables/useBibleData';
import '~/assets/css/bible-search.css';

type SearchResult = {
  readonly version: string;
  readonly book: string;
  readonly chapter: number;
  readonly snippet: string;
};

type SearchResponse = {
  readonly success: boolean;
  readonly count?: number;
  readonly results?: readonly SearchResult[];
  readonly error?: string;
};

const router = useRouter();
const api = useApi();
const { bookNames, versionNames, getChapterUnit } = useBibleData();
const query = ref('');
const version = ref('GAE');
const results = ref<readonly SearchResult[]>([]);
const message = ref('');
const isSearching = ref(false);
const hasSearched = ref(false);

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

const goBack = (): void => {
  if (history.length > 1) {
    router.back();
    return;
  }
  router.push('/bible');
};

const resultUrl = (result: SearchResult): string =>
  `/bible?book=${result.book}&chapter=${result.chapter}&version=${result.version}`;

const versionLabel = (code: string): string => versionNames[code] || code;
const bookLabel = (book: string): string => bookNames[book] || book;
const chapterSuffix = (book: string): string => getChapterUnit(book);

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
  typeof value.snippet === 'string';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
</script>
