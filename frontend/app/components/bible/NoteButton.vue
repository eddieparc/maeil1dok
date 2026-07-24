<template>
  <button
    class="note-btn"
    :class="{ 'has-notes': noteCount > 0 }"
    :disabled="isLoading"
    @click="handleClick"
    title="묵상노트"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="14,2 14,8 20,8" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="16" y1="13" x2="8" y2="13" stroke-linecap="round"/>
      <line x1="16" y1="17" x2="8" y2="17" stroke-linecap="round"/>
      <line x1="10" y1="9" x2="8" y2="9" stroke-linecap="round"/>
    </svg>
    <span v-if="noteCount > 0" class="note-count">{{ noteCount > 9 ? '9+' : noteCount }}</span>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  noteCount: number;
}>();

const emit = defineEmits<{
  click: [];
}>();

const isLoading = ref(false);

const handleClick = async () => {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    emit('click');
  } finally {
    setTimeout(() => {
      isLoading.value = false;
    }, 300);
  }
};
</script>

<style scoped>
.note-btn {
  position: relative;
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

.note-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

.note-btn.has-notes {
  color: var(--primary-color, #2A1111);
}

.note-btn.has-notes:hover:not(:disabled) {
  color: var(--primary-dark, #3A1A1A);
}

.note-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.note-count {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--primary-color, #2A1111);
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 다크모드 */
:root.dark .note-btn {
  color: var(--text-secondary);
}

:root.dark .note-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--text-primary);
}

:root.dark .note-btn.has-notes {
  color: var(--primary-color);
}
</style>
