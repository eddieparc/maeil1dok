<script setup lang="ts">
import { Check } from '@lucide/vue'
import AppButton from '~/components/ui/AppButton.vue'

export interface ReaderCompletionHighlight {
  id: number | string
  reference: string
  text: string
  color?: string | null
}

withDefaults(defineProps<{
  modalId?: string
  scheduleRange: string
  streak?: number | null
  highlights?: ReaderCompletionHighlight[]
  nextScheduleLabel?: string | null
  isLoading?: boolean
  shareDisabled?: boolean
}>(), {
  modalId: 'reader-completion',
  streak: null,
  highlights: () => [],
  nextScheduleLabel: null,
  isLoading: false,
  shareDisabled: false,
})

const emit = defineEmits<{
  share: []
  'share-highlight': [highlightId: number | string]
  next: []
  close: []
}>()
</script>

<template>
  <article class="reader-completion" data-testid="reader-completion-content">
    <div class="reader-completion__icon" aria-hidden="true">
      <Check :size="30" :stroke-width="2.4" />
    </div>
    <h2 :id="`modal-title-${modalId}`" class="reader-completion__title">오늘 통독을 완료했어요</h2>
    <p class="reader-completion__summary">
      <span>{{ scheduleRange }}</span>
      <span v-if="streak !== null && streak !== undefined"> · 연속 {{ streak }}일째</span>
    </p>

    <section v-if="highlights.length" class="reader-completion__highlights" aria-labelledby="reader-completion-highlights-title">
      <h3 id="reader-completion-highlights-title">오늘 하이라이트한 구절로 공유</h3>
      <button
        v-for="highlight in highlights"
        :key="highlight.id"
        type="button"
        class="reader-completion__highlight"
        :data-testid="`reader-completion-highlight-${highlight.id}`"
        @click="emit('share-highlight', highlight.id)"
      >
        <span class="reader-completion__swatch" :style="highlight.color ? { backgroundColor: highlight.color } : undefined" aria-hidden="true" />
        <span class="reader-completion__highlight-text">{{ highlight.text }}</span>
        <span class="reader-completion__reference">{{ highlight.reference }}</span>
      </button>
    </section>

    <div class="reader-completion__actions">
      <AppButton
        block
        :loading="isLoading"
        :disabled="shareDisabled"
        data-testid="reader-completion-share"
        @click="emit('share')"
      >
        SNS에 공유
      </AppButton>
      <AppButton
        v-if="nextScheduleLabel"
        block
        variant="secondary"
        :disabled="isLoading"
        data-testid="reader-completion-next"
        @click="emit('next')"
      >
        다음 일정으로 · {{ nextScheduleLabel }}
      </AppButton>
      <AppButton
        block
        variant="ghost"
        :disabled="isLoading"
        data-testid="reader-completion-close"
        @click="emit('close')"
      >
        닫기
      </AppButton>
    </div>
  </article>
</template>

<style scoped>
.reader-completion { box-sizing: border-box; width: 100%; padding: 28px 24px 20px; text-align: center; color: var(--color-text-primary); }
.reader-completion__icon { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin: 0 auto 16px; border-radius: var(--radius-pill); background: var(--color-accent-bg); color: var(--color-accent-primary); }
.reader-completion__title { margin: 0; font-size: 19px; font-weight: 700; line-height: 1.35; letter-spacing: var(--tracking-heading); }
.reader-completion__summary { margin: 8px 0 0; color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; font-variant-numeric: tabular-nums; }
.reader-completion__highlights { margin-top: 20px; padding: 14px; border: 1px solid var(--color-border-default); border-radius: var(--radius-control); background: var(--color-bg-secondary); text-align: left; }
.reader-completion__highlights h3 { margin: 0 0 8px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
.reader-completion__highlight { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: center; gap: 9px; box-sizing: border-box; width: 100%; min-height: var(--hit-min); padding: 8px; border: 0; border-radius: var(--radius-control); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.reader-completion__highlight:hover { background: var(--color-bg-hover); }
.reader-completion__highlight:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 1px; }
.reader-completion__swatch { width: 10px; height: 28px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-accent-bg); }
.reader-completion__highlight-text { overflow: hidden; font-size: 13px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.reader-completion__reference { color: var(--color-text-tertiary); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.reader-completion__actions { display: grid; gap: 8px; margin-top: 22px; }
</style>
