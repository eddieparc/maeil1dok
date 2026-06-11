<template>
  <UiModalBaseModal
    :model-value="modelValue"
    title="역본 선택"
    size="sm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="versions-container">
      <div class="version-category">
        <h3 class="category-title">한글 역본</h3>
        <div class="versions-list">
          <button
            v-for="code in koreanVersions"
            :key="code"
            class="version-select-button"
            :class="{ active: currentVersion === code }"
            @click="selectVersion(code)"
          >
            <div class="button-content">
              <span>{{ versionNames[code] }}<span class="new-badge" v-if="code === 'KNT'">N</span></span>
              <svg v-if="currentVersion === code" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      <div v-if="originalVersions.length" class="version-category">
        <h3 class="category-title">원어 성경</h3>
        <div class="versions-list">
          <button
            v-for="code in originalVersions"
            :key="code"
            class="version-select-button original"
            :class="{ 
              active: currentVersion === code,
              'rtl-version': versionMeta[code]?.direction === 'rtl'
            }"
            @click="selectVersion(code)"
          >
            <div class="button-content">
              <span class="version-label">
                {{ versionNames[code] }}
                <span v-if="code === 'HEB'" class="lang-badge hebrew">עב</span>
                <span v-if="code === 'GRK'" class="lang-badge greek">Ελ</span>
              </span>
              <svg v-if="currentVersion === code" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      <div v-if="englishVersions.length" class="version-category">
        <h3 class="category-title">영어 역본</h3>
        <div class="versions-list">
          <button
            v-for="code in englishVersions"
            :key="code"
            class="version-select-button"
            :class="{ active: currentVersion === code }"
            @click="selectVersion(code)"
          >
            <div class="button-content">
              <span>{{ versionNames[code] }}</span>
              <svg v-if="currentVersion === code" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  </UiModalBaseModal>
</template>

<script setup lang="ts">
import { VERSION_NAMES, VERSION_CATEGORIES, VERSION_META } from '~/composables/useBibleData';

defineProps<{
  modelValue: boolean;
  currentVersion: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'select': [version: string];
}>();

const versionNames = VERSION_NAMES;
const versionMeta = VERSION_META;
const koreanVersions = VERSION_CATEGORIES.korean;
const originalVersions = VERSION_CATEGORIES.original;
const englishVersions = VERSION_CATEGORIES.english;

const selectVersion = (version: string) => {
  emit('select', version);
  emit('update:modelValue', false);
};
</script>

<style scoped>
.versions-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.version-category {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.category-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-left: 0.25rem;
  margin: 0;
}

.versions-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.version-select-button {
  width: 100%;
  padding: 0.875rem 1rem;
  border: none;
  border-radius: 10px;
  background: var(--color-bg-primary, #f9fafb);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.version-select-button:hover {
  background: var(--color-bg-hover, #f3f4f6);
}

.version-select-button.active {
  background: var(--primary-light, #eef2ff);
}

.version-select-button.original {
  border-left: 3px solid var(--text-tertiary, #9ca3af);
}

.version-select-button.original.active {
  border-left-color: var(--primary-color, #6366f1);
}

.version-select-button .button-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.9375rem;
  color: var(--text-primary, #1f2937);
}

.version-select-button.active .button-content {
  color: var(--primary-color, #6366f1);
  font-weight: 500;
}

.version-select-button.active svg {
  color: var(--primary-color, #6366f1);
}

.version-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.new-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.375rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-text-inverse);
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-primary-hover) 100%);
  border-radius: 4px;
  vertical-align: middle;
}

.lang-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 500;
  border-radius: 4px;
}

.lang-badge.hebrew {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  font-family: 'SBL Hebrew', 'Times New Roman', serif;
}

.lang-badge.greek {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  font-family: 'SBL Greek', 'Times New Roman', serif;
}

.rtl-version .version-label::after {
  content: 'RTL';
  font-size: 0.5rem;
  padding: 0.0625rem 0.25rem;
  background: var(--text-tertiary, #9ca3af);
  color: white;
  border-radius: 2px;
  margin-left: 0.25rem;
}

:root.dark .version-select-button {
  background: var(--color-bg-secondary-dark, #2d2d2d);
}

:root.dark .version-select-button:hover {
  background: var(--color-bg-hover-dark, #3d3d3d);
}

:root.dark .version-select-button.active {
  background: rgba(99, 102, 241, 0.15);
}

:root.dark .category-title {
  color: var(--text-secondary-dark, #9ca3af);
}

:root.dark .version-select-button .button-content {
  color: var(--text-primary-dark, #e5e5e5);
}
</style>
