<script setup lang="ts">
import { Check, Circle } from '@lucide/vue'
import BottomSheet from '~/components/ui/BottomSheet.vue'
import AppButton from '~/components/ui/AppButton.vue'
import type { ReadingStatus } from '~/types/plan'

export interface ReaderPlanChapterRow {
  scheduleId: number
  book: string
  chapter: number
  label: string
  status: ReadingStatus
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  planName: string
  dateLabel: string
  rangeLabel: string
  rows?: ReaderPlanChapterRow[]
  nextScheduleLabel?: string | null
  isTongdokMode?: boolean
  isLoading?: boolean
}>(), {
  rows: () => [],
  nextScheduleLabel: null,
  isTongdokMode: true,
  isLoading: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'select-chapter': [value: { scheduleId: number; book: string; chapter: number }]
  'next-position': []
  'start-tongdok': []
  close: []
}>()

const statusText: Record<ReadingStatus, string> = {
  completed: '완료',
  not_completed: '미완료',
  current: '읽는 중',
  upcoming: '예정',
}

function updateOpen(value: boolean): void {
  emit('update:modelValue', value)
  if (!value) emit('close')
}
function selectChapter(row: ReaderPlanChapterRow): void {
  emit('select-chapter', { scheduleId: row.scheduleId, book: row.book, chapter: row.chapter })
}
</script>

<template>
  <BottomSheet
    :model-value="modelValue"
    title="성경통독표"
    data-testid="reader-plan-sheet"
    @update:model-value="updateOpen"
  >
    <div class="reader-plan">
      <p class="reader-plan__eyebrow">{{ planName }}</p>
      <p class="reader-plan__summary">{{ dateLabel }} · {{ rangeLabel }}</p>

      <ul class="reader-plan__rows" aria-label="현재 일정 장 목록">
        <li v-for="row in rows" :key="`${row.scheduleId}-${row.book}-${row.chapter}`">
          <button
            type="button"
            class="reader-plan__row"
            :class="`reader-plan__row--${row.status}`"
            :aria-current="row.status === 'current' ? 'step' : undefined"
            :data-testid="`reader-plan-row-${row.scheduleId}-${row.book}-${row.chapter}`"
            @click="selectChapter(row)"
          >
            <span class="reader-plan__status-icon" aria-hidden="true">
              <Check v-if="row.status === 'completed'" :size="16" :stroke-width="2.5" />
              <Circle v-else :size="16" :stroke-width="2" />
            </span>
            <span class="reader-plan__row-label">{{ row.label }}</span>
            <span class="reader-plan__status-text">{{ statusText[row.status] }}</span>
          </button>
        </li>
      </ul>

      <div v-if="nextScheduleLabel" class="reader-plan__next">
        <span>다음 일정</span>
        <strong>{{ nextScheduleLabel }}</strong>
      </div>
    </div>
    <template #footer>
      <div class="reader-plan__actions">
        <AppButton
          v-if="!isTongdokMode"
          block
          :loading="isLoading"
          data-testid="reader-plan-start"
          @click="emit('start-tongdok')"
        >
          통독으로 읽기
        </AppButton>
        <AppButton
          v-if="nextScheduleLabel"
          block
          :loading="isLoading"
          :variant="isTongdokMode ? 'primary' : 'secondary'"
          data-testid="reader-plan-next"
          @click="emit('next-position')"
        >
          다음 일정으로
        </AppButton>
      </div>
    </template>
  </BottomSheet>
</template>

<style scoped>
.reader-plan { padding: 4px 0 8px; }
.reader-plan__eyebrow { margin: 0; color: var(--color-accent-primary); font-size: 12px; font-weight: 600; }
.reader-plan__summary { margin: 7px 0 16px; color: var(--color-text-primary); font-size: 18px; font-weight: 700; line-height: 1.4; font-variant-numeric: tabular-nums; }
.reader-plan__rows { overflow: hidden; margin: 0; padding: 0; border: 1px solid var(--color-border-default); border-radius: var(--radius-control); list-style: none; }
.reader-plan__rows li + li { border-top: 1px solid var(--color-border-default); }
.reader-plan__row { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: 8px; box-sizing: border-box; width: 100%; min-height: var(--hit-min); padding: 8px 12px; border: 0; background: var(--color-bg-card); color: var(--color-text-primary); font: inherit; text-align: left; cursor: pointer; }
.reader-plan__row:hover { background: var(--color-bg-hover); }
.reader-plan__row:focus-visible { position: relative; outline: 3px solid var(--color-accent-focus-ring); outline-offset: -3px; }
.reader-plan__row--current { background: var(--color-accent-bg); }
.reader-plan__status-icon { display: flex; align-items: center; justify-content: center; color: var(--color-text-tertiary); }
.reader-plan__row--completed .reader-plan__status-icon,
.reader-plan__row--current .reader-plan__status-icon { color: var(--color-accent-primary); }
.reader-plan__row-label { font-size: 14px; font-weight: 600; }
.reader-plan__status-text { color: var(--color-text-tertiary); font-size: 11px; }
.reader-plan__row--current .reader-plan__status-text { color: var(--color-accent-primary); font-weight: 600; }
.reader-plan__next { display: grid; gap: 4px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border-default); color: var(--color-text-tertiary); font-size: 11px; }
.reader-plan__next strong { color: var(--color-text-primary); font-size: 14px; font-weight: 600; }
.reader-plan__actions { display: grid; gap: 8px; }
</style>
