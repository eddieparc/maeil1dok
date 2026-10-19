<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'
import BottomSheet from '~/components/ui/BottomSheet.vue'
import AppButton from '~/components/ui/AppButton.vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  scheduleTitle: string
  guideLink?: string | null
  isLoading?: boolean
}>(), {
  guideLink: null,
  isLoading: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'open-guide': [url: string]
  close: []
}>()

function updateOpen(value: boolean): void {
  emit('update:modelValue', value)
  if (!value) emit('close')
}

function openGuide(): void {
  if (props.guideLink) emit('open-guide', props.guideLink)
}
</script>

<template>
  <BottomSheet
    :model-value="modelValue"
    title="통독 가이드 · 해설"
    data-testid="reader-guide-sheet"
    @update:model-value="updateOpen"
  >
    <div class="reader-guide">
      <p class="reader-guide__eyebrow">통독 가이드 · 해설</p>
      <p class="reader-guide__title">{{ scheduleTitle }}</p>
      <p class="reader-guide__description">플랜에 등록된 해설 문서를 새 창에서 엽니다. 앱에서는 안전한 외부 화면으로 이동합니다.</p>
    </div>
    <template #footer="{ close }">
      <div class="reader-guide__actions">
        <AppButton variant="ghost" :disabled="isLoading" data-testid="reader-guide-close" @click="close">닫기</AppButton>
        <AppButton :loading="isLoading" :disabled="!guideLink" data-testid="reader-guide-open" @click="openGuide">
          가이드 열기 <ExternalLink :size="16" aria-hidden="true" />
        </AppButton>
      </div>
    </template>
  </BottomSheet>
</template>

<style scoped>
.reader-guide { padding: 4px 0 8px; }
.reader-guide__eyebrow { margin: 0; color: var(--color-accent-primary); font-size: 12px; font-weight: 600; }
.reader-guide__title { margin: 8px 0 0; color: var(--color-text-primary); font-size: 20px; font-weight: 700; line-height: 1.35; letter-spacing: var(--tracking-heading); }
.reader-guide__description { margin: 12px 0 0; color: var(--color-text-secondary); font-size: 14px; line-height: 1.65; }
.reader-guide__actions { display: grid; grid-template-columns: 1fr 1.5fr; gap: 8px; }
</style>
