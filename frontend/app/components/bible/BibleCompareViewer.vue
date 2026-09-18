<template>
  <!-- 비교 비활성: primary 슬롯만 렌더 -->
  <slot v-if="enabled === false" name="primary" />
  <div v-else class="bible-compare-viewer" :class="[`theme-${effectiveTheme}`]">
    <!-- 단일 헤더: 두 역본 선택 + 교체. 본문은 슬롯의 BibleViewer 하나가
         절 단위 병합 DOM을 렌더하므로 스크롤·선택·하이라이트가 그대로 동작한다. -->
    <div class="compare-header">
      <button class="version-btn" @click="$emit('select-primary')">
        {{ primaryVersionName }} <ChevronDownIcon :size="14" />
      </button>
      <button class="swap-btn" @click="$emit('swap')" aria-label="역본 교체">
        <SwapIcon :size="16" />
      </button>
      <button class="version-btn" @click="$emit('select-secondary')">
        {{ secondaryVersionName }} <ChevronDownIcon :size="14" />
      </button>
      <span v-if="isSecondaryLoading" class="compare-loading">불러오는 중…</span>
    </div>
    <div class="compare-body">
      <slot name="primary" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown as ChevronDownIcon, ArrowLeftRight as SwapIcon } from '@lucide/vue';
import { useReadingSettingsStore } from '~/stores/readingSettings';

defineProps<{
  enabled?: boolean;
  primaryVersionName?: string;
  secondaryVersionName?: string;
  isSecondaryLoading?: boolean;
}>();

defineEmits<{
  'select-primary': [];
  'select-secondary': [];
  'swap': [];
}>();

const settingsStore = useReadingSettingsStore();
const effectiveTheme = computed(() => settingsStore.effectiveTheme);
</script>

<style scoped>
.bible-compare-viewer {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.compare-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px var(--screen-gutter);
  border-bottom: 1px solid var(--color-border-primary);
  background: var(--color-bg-primary);
  flex-shrink: 0;
}

.version-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.version-btn:hover {
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

.swap-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.swap-btn:hover {
  background: var(--color-accent-primary);
  color: #fff;
}

.compare-loading {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-inline-start: auto;
}

.compare-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 슬롯의 BibleViewer가 남은 높이를 채우도록 */
.compare-body > :deep(*) {
  flex: 1;
  min-height: 0;
}
</style>
