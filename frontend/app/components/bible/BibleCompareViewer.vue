<template>
  <div class="bible-compare-viewer" :class="[`theme-${effectiveTheme}`]">
    <div class="compare-columns">
      <div 
        class="compare-column primary"
        :class="{ 'rtl-text': primaryMeta?.direction === 'rtl' }"
      >
        <div class="column-header">
          <button class="version-btn" @click="$emit('select-primary')">
            {{ primaryVersionName }}
            <ChevronDownIcon :size="14" />
          </button>
        </div>
        <div class="column-content" :style="contentStyle">
          <BibleViewerSkeleton v-if="isPrimaryLoading" :verse-count="8" />
          <div 
            v-else 
            class="bible-content"
            :class="{ 'rtl': primaryMeta?.direction === 'rtl' }"
            v-html="sanitizedPrimaryContent"
          ></div>
        </div>
      </div>

      <div class="compare-divider">
        <button class="swap-btn" @click="$emit('swap')" title="역본 교체">
          <SwapIcon :size="16" />
        </button>
      </div>

      <div 
        class="compare-column secondary"
        :class="{ 'rtl-text': secondaryMeta?.direction === 'rtl' }"
      >
        <div class="column-header">
          <button class="version-btn" @click="$emit('select-secondary')">
            {{ secondaryVersionName }}
            <ChevronDownIcon :size="14" />
          </button>
        </div>
        <div class="column-content" :style="contentStyle">
          <BibleViewerSkeleton v-if="isSecondaryLoading" :verse-count="8" />
          <div 
            v-else 
            class="bible-content"
            :class="{ 'rtl': secondaryMeta?.direction === 'rtl' }"
            v-html="sanitizedSecondaryContent"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useReadingSettingsStore, FONT_FAMILIES, FONT_WEIGHTS } from '~/stores/readingSettings';
import { useSanitize } from '~/composables/useSanitize';
import BibleViewerSkeleton from './BibleViewerSkeleton.vue';
import ChevronDownIcon from '~/components/icons/ChevronDownIcon.vue';
import SwapIcon from '~/components/icons/SwapIcon.vue';

interface VersionMeta {
  direction: string;
  language: string;
  testament: string;
}

const props = defineProps<{
  primaryContent: string;
  secondaryContent: string;
  primaryVersionName: string;
  secondaryVersionName: string;
  primaryMeta?: VersionMeta;
  secondaryMeta?: VersionMeta;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
}>();

defineEmits<{
  'select-primary': [];
  'select-secondary': [];
  'swap': [];
}>();

const settingsStore = useReadingSettingsStore();
const settings = computed(() => settingsStore.settings);
const effectiveTheme = computed(() => settingsStore.effectiveTheme);
const { sanitize } = useSanitize();

const contentStyle = computed(() => ({
  '--reading-font-family': FONT_FAMILIES[settings.value.fontFamily].css,
  '--reading-font-size': `${Math.max(settings.value.fontSize - 2, 14)}px`,
  '--reading-font-weight': FONT_WEIGHTS[settings.value.fontWeight],
  '--reading-line-height': settings.value.lineHeight,
}));

const sanitizedPrimaryContent = computed(() => sanitize(props.primaryContent));
const sanitizedSecondaryContent = computed(() => sanitize(props.secondaryContent));
</script>

<style scoped>
.bible-compare-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.compare-columns {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.compare-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.compare-column.rtl-text {
  direction: rtl;
}

.column-header {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  background: var(--color-bg-secondary, #f9fafb);
  flex-shrink: 0;
}

.version-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #1f2937);
  cursor: pointer;
  transition: all 0.2s;
}

.version-btn:hover {
  background: var(--color-bg-hover, #f3f4f6);
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  font-family: var(--reading-font-family);
  font-size: var(--reading-font-size);
  font-weight: var(--reading-font-weight);
  line-height: var(--reading-line-height);
}

.compare-divider {
  width: 1px;
  background: var(--color-border, #e5e7eb);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0.5rem;
  flex-shrink: 0;
}

.swap-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 50%;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
  transform: translateX(-50%);
}

.swap-btn:hover {
  background: var(--primary-light, #eef2ff);
  color: var(--primary-color, #2A1111);
  border-color: var(--primary-color, #2A1111);
}

.bible-content {
  word-break: keep-all;
}

.bible-content.rtl {
  direction: rtl;
  text-align: right;
  font-family: 'SBL Hebrew', 'Times New Roman', serif;
}

.bible-content :deep(.verse) {
  display: flex;
  align-items: flex-start;
  padding: 0.25rem 0;
  gap: 0.25rem;
}

.bible-content :deep(.verse-number) {
  color: var(--text-tertiary, #9ca3af);
  font-size: 0.75em;
  font-weight: 500;
  min-width: 1.25em;
  flex-shrink: 0;
}

.bible-content :deep(.verse-text) {
  flex: 1;
}

.theme-dark .column-header {
  background: var(--color-bg-secondary-dark, #2d2d2d);
  border-color: var(--color-border-dark, #404040);
}

.theme-dark .version-btn {
  background: var(--color-bg-card-dark, #1f1f1f);
  border-color: var(--color-border-dark, #404040);
  color: var(--text-primary-dark, #e5e5e5);
}

.theme-dark .version-btn:hover {
  background: var(--color-bg-hover-dark, #3d3d3d);
}

.theme-dark .compare-divider {
  background: var(--color-border-dark, #404040);
}

.theme-dark .swap-btn {
  background: var(--color-bg-card-dark, #1f1f1f);
  border-color: var(--color-border-dark, #404040);
  color: var(--text-secondary-dark, #9ca3af);
}

.theme-dark .swap-btn:hover {
  background: rgba(42, 17, 17, 0.15);
}

@media (max-width: 640px) {
  .compare-columns {
    flex-direction: column;
  }

  .compare-divider {
    width: 100%;
    height: 1px;
    padding: 0;
    padding-left: 50%;
  }

  .swap-btn {
    transform: translateY(-50%);
  }

  .column-content {
    max-height: 50vh;
  }
}
</style>
