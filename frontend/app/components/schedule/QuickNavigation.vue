<template>
  <div class="controls">
    <span class="controls-label">빠른 이동</span>
    <span class="controls-divider">|</span>
    <div class="control-buttons">
      <button
        v-if="showCurrentLocation"
        class="control-button"
        aria-label="현재 읽는 위치로 이동"
        @click="$emit('scrollTo', 'currentLocation')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 6L9 17L4 12"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        현재위치
      </button>
      <button class="control-button" aria-label="오늘 일정으로 이동" @click="$emit('scrollTo', 'today')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        오늘
      </button>
      <button class="control-button" aria-label="마지막 미완료 일정으로 이동" @click="$emit('scrollTo', 'lastIncomplete')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7h18M3 12h18M3 17h18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        마지막 미완료
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ScrollTarget } from '~/types/plan';

defineProps<{
  showCurrentLocation?: boolean;
}>();

defineEmits<{
  scrollTo: [target: ScrollTarget];
}>();
</script>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.controls-label {
  font-size: 0.75rem;
  color: var(--color-slate-500);
  font-weight: 500;
}

.controls-divider {
  color: var(--color-slate-300);
  font-size: 0.75rem;
}

.control-buttons {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.control-button {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: var(--color-slate-50);
  border: 1px solid var(--color-slate-200);
  border-radius: 6px;
  font-size: 0.6875rem;
  color: var(--color-slate-600);
  transition: all 0.15s;
  white-space: nowrap;
}

.control-button:hover {
  background: var(--color-slate-100);
  border-color: var(--color-slate-300);
}

.control-button:active {
  background: var(--color-slate-200);
}

.control-button svg {
  flex-shrink: 0;
}
</style>
