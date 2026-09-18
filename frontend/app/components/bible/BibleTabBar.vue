<template>
  <div class="bible-tab-bar" role="tablist" aria-label="성경 본문 탭">
    <div class="bible-tab-list">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="bible-tab"
        :class="{ 'is-active': tab.id === activeTabId }"
        role="tab"
        :aria-selected="tab.id === activeTabId"
        :tabindex="tab.id === activeTabId ? 0 : -1"
        @click="$emit('switch', tab.id)"
        @keydown.enter="$emit('switch', tab.id)"
        @keydown.space.prevent="$emit('switch', tab.id)"
      >
        <span class="bible-tab-label">{{ tab.label }}</span>
        <button
          class="bible-tab-close"
          type="button"
          :aria-label="`${tab.label} 탭 닫기`"
          @click.stop="$emit('close', tab.id)"
        >
          <XMarkIcon :size="12" />
        </button>
      </div>
      <button
        class="bible-tab-add"
        type="button"
        aria-label="새 탭 추가"
        title="새 탭 추가"
        @click="$emit('add')"
      >
        <PlusIcon :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PlusIcon } from '@lucide/vue';
import XMarkIcon from '~/components/icons/XMarkIcon.vue';
import type { BibleTab } from '~/utils/bibleTabs';

interface Props {
  tabs: BibleTab[];
  activeTabId: string | null;
}

defineProps<Props>();

defineEmits<{
  switch: [tabId: string];
  close: [tabId: string];
  add: [];
}>();
</script>

<style scoped>
.bible-tab-bar {
  background: color-mix(in srgb, var(--color-bg-primary, #f9fafb) 92%, #f3f0ea 8%);
  border-bottom: 1px solid rgba(17, 24, 39, 0.045);
  padding: 0.0625rem 0.5rem;
}

.bible-tab-list {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.bible-tab-list::-webkit-scrollbar {
  display: none;
}

.bible-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  max-width: 10rem;
  min-height: 24px;
  padding: 0 0.25rem 0 0.5rem;
  border-radius: 8px;
  border: 1px solid transparent;
  color: var(--text-primary, #1f2937);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.bible-tab:hover {
  background: var(--color-bg-hover, #f3f4f6);
}

.bible-tab.is-active {
  background: var(--primary-light, rgba(42, 17, 17, 0.08));
  border-color: var(--primary-color, #2A1111);
  color: var(--primary-color, #2A1111);
}

.bible-tab-label {
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bible-tab.is-active .bible-tab-label {
  color: var(--primary-color, #2A1111);
}

.bible-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.bible-tab-close:hover {
  background: var(--color-bg-active, #e5e7eb);
  color: var(--text-primary, #1f2937);
}

.bible-tab-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 8px;
  border: 1px dashed var(--color-border, #d1d5db);
  background: transparent;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.bible-tab-add:hover {
  background: var(--color-bg-hover, #f3f4f6);
  border-color: var(--text-secondary, #6b7280);
  color: var(--text-primary, #1f2937);
}

.bible-tab-add:active {
  transform: scale(0.94);
}

[data-theme="dark"] .bible-tab-bar {
  background: var(--color-bg-primary);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

[data-theme="dark"] .bible-tab {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .bible-tab:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

[data-theme="dark"] .bible-tab.is-active {
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

[data-theme="dark"] .bible-tab.is-active .bible-tab-label {
  color: var(--color-accent-primary);
}

[data-theme="dark"] .bible-tab-close {
  color: var(--color-text-tertiary);
}

[data-theme="dark"] .bible-tab-close:hover {
  background: rgba(255, 255, 255, 0.14);
  color: var(--color-text-primary);
}

[data-theme="dark"] .bible-tab-add {
  color: var(--color-text-secondary);
  border-color: rgba(255, 255, 255, 0.2);
}

[data-theme="dark"] .bible-tab-add:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-text-secondary);
  color: var(--color-text-primary);
}

/* 모바일 터치 타깃 확보 */
@media (max-width: 767px) {
  .bible-tab {
    min-height: 32px;
  }

  .bible-tab-close {
    width: 26px;
    height: 26px;
  }

  .bible-tab-add {
    width: 32px;
    height: 32px;
  }
}
</style>
