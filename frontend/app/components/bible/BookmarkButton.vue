<template>
  <button
    class="bookmark-btn"
    :class="{ active: isBookmarked }"
    :disabled="isLoading"
    @click="handleClick"
    title="북마크"
  >
    <svg v-if="isBookmarked" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
    </svg>
    <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  isBookmarked: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const isLoading = ref(false);

const handleClick = async () => {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    emit('toggle');
  } finally {
    // 짧은 딜레이 후 로딩 해제 (UI 피드백용)
    setTimeout(() => {
      isLoading.value = false;
    }, 300);
  }
};
</script>

<style scoped>
.bookmark-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
  /* 터치 타겟 최적화 */
  -webkit-tap-highlight-color: transparent;
}

.bookmark-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

.bookmark-btn.active {
  color: var(--primary-color, #2A1111);
}

.bookmark-btn.active:hover:not(:disabled) {
  color: var(--primary-dark, #3A1A1A);
}

.bookmark-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 다크모드 */
:root.dark .bookmark-btn {
  color: var(--text-secondary);
}

:root.dark .bookmark-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--text-primary);
}

:root.dark .bookmark-btn.active {
  color: var(--primary-color);
}
</style>
