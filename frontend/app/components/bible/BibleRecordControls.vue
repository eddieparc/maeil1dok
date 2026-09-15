<template>
  <button v-if="actionOnly" type="button" class="icon-btn" aria-label="기록 검색" :aria-expanded="showSearch" :aria-controls="searchId" @click="showSearch = !showSearch"><Search :size="20" aria-hidden="true" /></button>
  <div v-else class="record-controls">
    <nav class="record-navigation" aria-label="내 기록 종류">
      <NuxtLink v-for="segment in segments" :key="segment.to" :to="segment.to" :aria-current="activeRoute === segment.to ? 'page' : undefined">{{ segment.label }}</NuxtLink>
    </nav>
    <input v-if="showSearch" :id="searchId" v-model="searchQuery" class="search-input" type="search" :aria-label="searchLabel" :placeholder="searchLabel" />
    <div class="filter-bar">
      <select v-model="filterBook" class="filter-select" aria-label="성경 필터">
        <option value="">전체 성경</option>
        <optgroup label="구약"><option v-for="book in BIBLE_BOOKS.old" :key="book.id" :value="book.id">{{ book.name }}</option></optgroup>
        <optgroup label="신약"><option v-for="book in BIBLE_BOOKS.new" :key="book.id" :value="book.id">{{ book.name }}</option></optgroup>
      </select>
      <select v-model="sortOrder" class="filter-select" aria-label="정렬"><option value="recent">최근순</option><option value="oldest">오래된순</option></select>
      <slot name="filters" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search } from '@lucide/vue';
import { BIBLE_BOOKS } from '~/composables/useBibleData';
defineProps<{
  readonly activeRoute?: string;
  readonly searchId: string;
  readonly searchLabel?: string;
  readonly actionOnly?: boolean;
}>();
const showSearch = defineModel<boolean>('showSearch', { default: false });
const searchQuery = defineModel<string>('searchQuery', { default: '' });
const filterBook = defineModel<string>('filterBook', { default: '' });
const sortOrder = defineModel<string>('sortOrder', { default: 'recent' });
const segments = [
  { to: '/bible/notes', label: '묵상노트' },
  { to: '/bible/highlights', label: '하이라이트' },
  { to: '/bible/bookmarks', label: '북마크' },
] as const;
</script>

<style scoped>
.record-controls { display: grid; gap: 14px; padding: 14px 20px; letter-spacing: var(--tracking-body); }
.record-navigation { display: flex; padding: 4px; border-radius: var(--radius-pill); background: var(--color-bg-tertiary); }
.record-navigation a { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 44px; border-radius: var(--radius-pill); text-decoration: none; font-size: 13px; font-weight: 600; color: var(--color-text-secondary); }
.record-navigation a[aria-current="page"] { background: var(--color-bg-card); color: var(--color-accent-primary); box-shadow: var(--shadow-card); }
.filter-bar { display: flex; flex-wrap: wrap; gap: 8px; }
.filter-select, .filter-bar :slotted(select), .search-input { min-height: 44px; min-width: 0; padding: 8px 14px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); font-size: 13px; font-weight: 600; color: var(--color-text-secondary); background: var(--color-bg-card); }
.filter-select, .filter-bar :slotted(select) { max-width: 65%; cursor: pointer; }
.search-input { width: 100%; box-sizing: border-box; }
.search-input::placeholder { color: var(--color-text-tertiary); }
.icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 1px solid transparent; border-radius: var(--radius-pill); background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: background-color var(--duration-micro) ease; }
.icon-btn:hover, .filter-select:hover { background: var(--color-bg-hover); }
.icon-btn:focus-visible, a:focus-visible, select:focus-visible, input:focus-visible, .filter-bar :slotted(select:focus-visible) { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .icon-btn { transition: none; } }
</style>
