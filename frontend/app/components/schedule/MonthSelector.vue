<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { MONTHS } from '~/constants/bible';
const props = defineProps<{
  modelValue: number;
  progress?: Record<number, { done: number; total: number }>;
  disabled?: boolean;
}>();
defineEmits<{ 'update:modelValue': [month: number] }>();
const containerRef = ref<HTMLElement | null>(null);
const currentButtonRef = ref<HTMLElement | null>(null);
function progressState(month: number) {
  const summary = props.progress?.[month];
  return summary && summary.total > 0 && summary.done === summary.total ? 'completed' : summary?.done ? 'partial' : 'unstarted';
}
function scrollToCurrentMonth() {
  const container = containerRef.value;
  const button = currentButtonRef.value;
  if (container && button) container.scrollTo({ left: button.offsetLeft - container.offsetWidth / 2 + button.offsetWidth / 2, behavior: 'smooth' });
}
onMounted(() => { void nextTick(scrollToCurrentMonth); });
watch(() => props.modelValue, () => { void nextTick(scrollToCurrentMonth); });
</script>

<template>
  <div ref="containerRef" class="month-scroll" role="group" aria-label="월 선택">
    <button v-for="month in MONTHS" :key="month" type="button" :data-month="month" class="month-button"
      :class="{ active: month === modelValue, empty: progress?.[month]?.total === 0 }" :aria-pressed="month === modelValue" :disabled="disabled"
      :aria-label="progress?.[month] ? `${month}월, ${progress[month].total}개 중 ${progress[month].done}개 완료` : `${month}월`"
      :ref="el => { if (month === modelValue) currentButtonRef = el as HTMLElement }" @click="$emit('update:modelValue', month)">
      {{ month }}월<span v-if="progress?.[month]" class="month-dot" :data-progress="progressState(month)" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.month-scroll { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 4px 0; }
.month-scroll::-webkit-scrollbar { display: none; }
.month-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0; min-width: var(--hit-min); min-height: var(--hit-min); padding: 8px 12px; border: 1px solid var(--color-border-default); border-radius: var(--radius-control); background: var(--color-bg-card); color: var(--color-text-secondary); font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: background-color .15s, color .15s, transform .15s; }
.month-button:hover:not(:disabled) { background: var(--color-accent-bg); }
.month-button.empty { color: var(--color-text-tertiary); }
.month-button.active { background: var(--color-accent-primary); color: var(--color-text-inverse); border-color: var(--color-accent-primary); }
.month-button.active:hover:not(:disabled) { background: var(--color-accent-primary-hover); }
.month-dot { width: 6px; height: 6px; border-radius: var(--radius-pill); background: var(--color-border-default); }
.month-dot[data-progress="completed"] { background: var(--color-accent-primary); }
.month-dot[data-progress="partial"] { background: var(--color-reading-current); }
.active .month-dot { background: currentColor; opacity: .45; }
.active .month-dot[data-progress="partial"] { opacity: .7; }
.active .month-dot[data-progress="completed"] { opacity: 1; }
.month-button:disabled { cursor: not-allowed; opacity: .5; }
.month-button:active:not(:disabled) { transform: scale(.97); }
@media (prefers-reduced-motion: reduce) { .month-button { transition: none; } .month-button:active:not(:disabled) { transform: none; } }
</style>
