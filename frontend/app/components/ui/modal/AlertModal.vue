<template>
  <div class="alert-modal">
    <!-- Icon -->
    <div v-if="icon" class="alert-icon" :class="`alert-icon-${icon}`">
      <TriangleAlertIcon v-if="icon === 'warning'" :size="24" />
      <CircleXIcon v-else-if="icon === 'error'" :size="24" />
      <InfoIcon v-else-if="icon === 'info'" :size="24" />
      <CircleCheckIcon v-else-if="icon === 'success'" :size="24" />
    </div>

    <!-- Title -->
    <h3 :id="`modal-title-${modalId}`" class="alert-title">
      {{ title }}
    </h3>

    <!-- Description -->
    <p
      v-if="description"
      :id="`modal-description-${modalId}`"
      class="alert-description"
    >
      {{ description }}
    </p>

    <button
      v-if="copyText"
      type="button"
      class="alert-copy-btn"
      @click="copyDetail"
    >
      {{ copyStatus === 'copied' ? '복사됨' : copyStatus === 'failed' ? '복사 실패' : '오류 ID 복사' }}
    </button>
    <span class="sr-only" aria-live="polite">
      {{ copyStatus === 'copied'
        ? '오류 ID가 복사되었습니다.'
        : copyStatus === 'failed'
          ? '오류 ID를 복사하지 못했습니다. 직접 선택해 주세요.'
          : '' }}
    </span>

    <!-- Action -->
    <div class="alert-actions">
      <button
        type="button"
        class="alert-btn"
        @click="handleConfirm"
      >
        {{ confirmText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon } from '@lucide/vue'
import { ref } from 'vue'
import { useModal } from '~/composables/useModal'
import type { ConfirmIcon } from '~/types/modal'

const props = withDefaults(defineProps<{
  modalId: string
  title: string
  description?: string
  confirmText?: string
  icon?: ConfirmIcon
  copyText?: string
}>(), {
  confirmText: '확인'
})

const modal = useModal()
const copyStatus = ref<'idle' | 'copied' | 'failed'>('idle')

async function copyDetail() {
  if (!props.copyText) return
  try {
    await navigator.clipboard.writeText(props.copyText)
    copyStatus.value = 'copied'
  } catch {
    copyStatus.value = 'failed'
  }
}

function handleConfirm() {
  modal.close(props.modalId)
}
</script>

<style scoped>
.alert-modal {
  padding: 1.5rem;
  text-align: center;
}

.alert-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  border-radius: 50%;
}

.alert-icon-warning {
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
}

.alert-icon-error {
  background: var(--color-error-bg);
  color: var(--color-error-text);
}

.alert-icon-info {
  background: var(--color-info-bg);
  color: var(--color-info-text);
}

.alert-icon-success {
  background: var(--color-success-bg);
  color: var(--color-success-text);
}

.alert-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 0.5rem;
}

.alert-description {
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
  margin: 0 0 1.5rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  user-select: text;
  white-space: pre-line;
  word-break: keep-all;
}

.alert-copy-btn {
  min-height: var(--hit-min);
  margin: -0.5rem auto 1.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
}

.alert-copy-btn:hover {
  background: var(--color-bg-hover);
}

.alert-actions {
  display: flex;
}

.alert-btn {
  flex: 1;
  min-height: var(--hit-min);
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: var(--radius-pill);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
}

.alert-btn:hover {
  background: var(--color-accent-primary-hover);
}

/* Shared semantic tokens supply both themes. */
.alert-btn:focus-visible,
.alert-copy-btn:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px var(--color-accent-primary);
}

@media (prefers-reduced-motion: reduce) {
  .alert-btn { transition: none; }
}
</style>
