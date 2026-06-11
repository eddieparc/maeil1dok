<template>
  <div class="error-state">
    <div class="error-icon">
      <CircleAlertIcon :size="48" />
    </div>
    <h3 class="error-title">{{ title }}</h3>
    <p class="error-message">{{ message }}</p>
    <button v-if="showRetry" @click="$emit('retry')" class="retry-button">
      <RefreshCwIcon :size="16" />
      다시 시도
    </button>
  </div>
</template>

<script setup lang="ts">
import { CircleAlertIcon, RefreshCwIcon } from '@lucide/vue'

interface Props {
  title?: string
  message?: string
  showRetry?: boolean
}

withDefaults(defineProps<Props>(), {
  title: '오류가 발생했습니다',
  message: '잠시 후 다시 시도해주세요.',
  showRetry: true
})

defineEmits<{
  retry: []
}>()
</script>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  min-height: 200px;
  text-align: center;
}

.error-icon {
  color: var(--color-error);
  margin-bottom: 1rem;
}

.error-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 0.5rem 0;
}

.error-message {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0 0 1.5rem 0;
  max-width: 400px;
}

.retry-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  min-height: 44px;
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-button:hover {
  background: var(--color-accent-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.retry-button:active {
  transform: translateY(0);
}
</style>
