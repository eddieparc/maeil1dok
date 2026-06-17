<template>
  <NuxtLink
    to="/bible/search"
    class="bible-search-button"
    aria-label="성경 본문 검색 열기"
    title="본문 검색"
  >
    <SearchIcon :size="20" />
  </NuxtLink>
</template>

<script setup lang="ts">
import { SearchIcon } from '@lucide/vue';
</script>

<style scoped>
.bible-search-button {
  align-items: center;
  border-radius: 8px;
  color: var(--text-secondary, #6b7280);
  display: flex;
  height: 36px;
  justify-content: center;
  transition: all 0.2s;
  width: 36px;
}

.bible-search-button:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
}
</style>
