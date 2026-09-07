<template>
  <div class="month-scroll" ref="containerRef">
    <button
      v-for="month in MONTHS"
      :key="month"
      :class="['month-button', { active: month === modelValue }]"
      :ref="el => { if (month === modelValue) currentButtonRef = el as HTMLElement }"
      @click="$emit('update:modelValue', month)"
    >
      {{ month }}월
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import { MONTHS } from '~/constants/bible';

const props = defineProps<{
  modelValue: number;
}>();

defineEmits<{
  'update:modelValue': [month: number];
}>();

const containerRef = ref<HTMLElement | null>(null);
const currentButtonRef = ref<HTMLElement | null>(null);

/**
 * 현재 선택된 월로 스크롤
 */
function scrollToCurrentMonth() {
  if (!containerRef.value || !currentButtonRef.value) return;

  const container = containerRef.value;
  const button = currentButtonRef.value;

  // 버튼이 컨테이너의 중앙에 오도록 스크롤 위치 계산
  const containerWidth = container.offsetWidth;
  const buttonLeft = button.offsetLeft;
  const buttonWidth = button.offsetWidth;
  const scrollLeft = buttonLeft - (containerWidth / 2) + (buttonWidth / 2);

  container.scrollTo({
    left: scrollLeft,
    behavior: 'smooth',
  });
}

// 마운트 시 현재 월로 스크롤
onMounted(() => {
  nextTick(scrollToCurrentMonth);
});

// 선택된 월이 변경되면 스크롤
watch(() => props.modelValue, () => {
  nextTick(scrollToCurrentMonth);
});
</script>

<style scoped>
.month-scroll {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0.25rem 0;
  scroll-behavior: smooth;
}

.month-scroll::-webkit-scrollbar {
  display: none;
}

.month-button {
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  background: var(--color-slate-100);
  color: var(--color-slate-600);
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.month-button:hover {
  background: var(--color-slate-200);
}

.month-button.active {
  background: var(--primary-color);
  color: white;
}

[data-theme="dark"] .month-button.active {
  background: var(--color-schedule-completed-bg);
  color: var(--color-schedule-completed-text);
  border-color: var(--color-schedule-completed-text);
}
</style>
