<template>
  <div class="highlight-palette">
    <div class="color-grid">
      <!-- 기본 색상 -->
      <button
        v-for="color in DEFAULT_HIGHLIGHT_COLORS"
        :key="color.value"
        class="color-btn"
        :class="{ active: modelValue === color.value }"
        :style="{ background: color.value }"
        :title="color.name"
        :aria-label="`${color.name} 형광펜`"
        :aria-pressed="modelValue === color.value"
        @click="$emit('update:modelValue', color.value)"
      />

      <!-- 사용자 지정 색상 -->
      <button
        v-for="color in customColors"
        :key="color"
        class="color-btn custom"
        :class="{ active: modelValue === color }"
        :style="{ background: color }"
        aria-label="사용자 지정 형광펜 색상"
        :aria-pressed="modelValue === color"
        @click="$emit('update:modelValue', color)"
      />

      <!-- 색상 추가 버튼 -->
      <button class="color-btn add" @click="openColorPicker" title="색상 추가" aria-label="형광펜 색상 추가">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" stroke-linecap="round"/>
          <line x1="5" y1="12" x2="19" y2="12" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- 숨겨진 색상 선택기 -->
    <input
      ref="colorPickerRef"
      type="color"
      class="color-picker-hidden"
      @change="handleCustomColor"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { DEFAULT_HIGHLIGHT_COLORS } from '~/composables/useHighlight';

defineProps<{
  modelValue: string;
  customColors: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'add-custom': [color: string];
}>();

const colorPickerRef = ref<HTMLInputElement | null>(null);

const openColorPicker = () => {
  colorPickerRef.value?.click();
};

const handleCustomColor = (e: Event) => {
  const color = (e.target as HTMLInputElement).value;
  emit('add-custom', color);
  emit('update:modelValue', color);
};
</script>

<style scoped>
.highlight-palette {
  padding: 0.5rem;
}

.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.color-btn {
  position: relative;
  width: 32px;
  height: 32px;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 시각 크기는 32px로 유지하되 터치 영역을 44px로 확장 (WCAG 2.5.5) */
.color-btn::before {
  content: '';
  position: absolute;
  inset: -6px;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: var(--primary-color, #2A1111);
  box-shadow: 0 0 0 2px var(--color-bg-primary, #f9fafb), 0 0 0 4px var(--primary-color, #2A1111);
}

.color-btn.add {
  background: var(--color-bg-tertiary, #e5e7eb);
  color: var(--text-secondary, #6b7280);
}

.color-btn.add:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

.color-picker-hidden {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
}

/* 다크모드 */
:root.dark .color-btn {
  /* 다크모드에서 파스텔 색상이 잘 보이도록 테두리 추가 */
  border: 1px solid rgba(255, 255, 255, 0.2);
  /* 색상을 더 선명하게 */
  filter: saturate(1.2) brightness(0.9);
}

:root.dark .color-btn:hover {
  border-color: rgba(255, 255, 255, 0.4);
}

:root.dark .color-btn.add {
  background: var(--color-bg-tertiary);
  color: var(--text-secondary);
  filter: none;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

:root.dark .color-btn.add:hover {
  background: var(--color-bg-hover);
  color: var(--text-primary);
}

:root.dark .color-btn.active {
  box-shadow: 0 0 0 2px var(--color-bg-primary), 0 0 0 4px var(--primary-color);
  border-color: transparent;
}
</style>
