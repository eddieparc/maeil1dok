<template>
  <slot v-if="enabled === false" name="primary" />
  <div v-else class="bible-compare-viewer" :class="[`theme-${effectiveTheme}`]">
    <div class="compare-columns">
      <div 
        class="compare-column primary"
        :class="{ 'rtl-text': primaryMeta?.direction === 'rtl' }"
      >
        <div class="column-header">
          <button
            ref="primaryBtnRef"
            class="version-btn"
            :aria-expanded="openMenu === 'primary'"
            aria-haspopup="listbox"
            @click.stop="toggleMenu('primary')"
          >
            {{ primaryVersionName }}
            <ChevronDownIcon :size="14" />
          </button>
        </div>
        <slot name="primary">
        <div class="column-content viewer-content">
          <BibleViewer :content="primaryContent" :book="book" :chapter="chapter"
            :version="primaryVersionName" :is-loading="isPrimaryLoading" />
        </div>
        </slot>
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
          <button
            ref="secondaryBtnRef"
            class="version-btn"
            :aria-expanded="openMenu === 'secondary'"
            aria-haspopup="listbox"
            @click.stop="toggleMenu('secondary')"
          >
            {{ secondaryVersionName }}
            <ChevronDownIcon :size="14" />
          </button>
        </div>
        <div class="column-content viewer-content">
          <BibleViewer :content="secondaryContent" :book="book" :chapter="chapter"
            :version="secondaryVersionName" :is-loading="isSecondaryLoading" />
        </div>
      </div>
    </div>

    <!-- 역본 선택 드롭다운 (overflow 클리핑을 피해 body로 텔레포트) -->
    <Teleport to="body">
      <Transition name="version-menu-fade">
        <div
          v-if="openMenu"
          ref="menuRef"
          class="version-menu"
          :style="menuStyle"
          role="listbox"
          :aria-label="openMenu === 'primary' ? '본문 역본 선택' : '비교 역본 선택'"
        >
          <button
            v-for="(name, code) in VISIBLE_VERSION_NAMES"
            :key="code"
            type="button"
            role="option"
            :aria-selected="code === activeVersionCode"
            :class="['version-menu-item', { active: code === activeVersionCode }]"
            @click="pickVersion(String(code))"
          >
            {{ name }}
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useReadingSettingsStore } from '~/stores/readingSettings';
import { VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';
import BibleViewer from '~/components/bible/BibleViewer.vue';
import ChevronDownIcon from '~/components/icons/ChevronDownIcon.vue';
import SwapIcon from '~/components/icons/SwapIcon.vue';

interface VersionMeta {
  direction: string;
  language: string;
  testament: string;
}

const props = defineProps<{
  enabled?: boolean;
  book: string;
  chapter: number;
  primaryContent: string;
  secondaryContent: string;
  primaryVersionName: string;
  secondaryVersionName: string;
  primaryVersionCode?: string;
  secondaryVersionCode?: string;
  primaryMeta?: VersionMeta;
  secondaryMeta?: VersionMeta;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
}>();

const emit = defineEmits<{
  'version-select': [column: 'primary' | 'secondary', version: string];
  'swap': [];
}>();

type CompareColumn = 'primary' | 'secondary';

// 역본 드롭다운: 버튼 바로 아래에 뜨는 간단한 목록. 열린 컬럼만 추적한다.
const openMenu = ref<CompareColumn | null>(null);
const primaryBtnRef = ref<HTMLElement | null>(null);
const secondaryBtnRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});

const activeVersionCode = computed(() =>
  openMenu.value === 'primary' ? props.primaryVersionCode : props.secondaryVersionCode);

const toggleMenu = (column: CompareColumn) => {
  if (openMenu.value === column) { openMenu.value = null; return; }
  const btn = column === 'primary' ? primaryBtnRef.value : secondaryBtnRef.value;
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const menuWidth = Math.max(rect.width, 148);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - menuWidth - 8);
  menuStyle.value = { top: `${rect.bottom + 4}px`, left: `${left}px`, minWidth: `${menuWidth}px` };
  openMenu.value = column;
};

const closeMenu = () => { openMenu.value = null; };

const pickVersion = (version: string) => {
  const column = openMenu.value;
  closeMenu();
  if (column) emit('version-select', column, version);
};

const handleDocClick = (event: MouseEvent) => {
  const target = event.target as Node;
  if (menuRef.value?.contains(target)) return;
  closeMenu();
};
const handleDocKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeMenu();
};

onMounted(() => {
  document.addEventListener('click', handleDocClick);
  document.addEventListener('keydown', handleDocKeydown);
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', closeMenu, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick);
  document.removeEventListener('keydown', handleDocKeydown);
  window.removeEventListener('resize', closeMenu);
  window.removeEventListener('scroll', closeMenu, true);
});

const settingsStore = useReadingSettingsStore();
const effectiveTheme = computed(() => settingsStore.effectiveTheme);
</script>

<style scoped>
.bible-compare-viewer {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-primary);
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

/* 역본 드롭다운 (body 텔레포트라 scoped가 아니라 :global 필요) */
:global(.version-menu) {
  position: fixed;
  z-index: 1000;
  max-height: 320px;
  overflow-y: auto;
  padding: 0.25rem;
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border-default, #e5e7eb);
  border-radius: 10px;
  box-shadow: var(--shadow-md, 0 8px 24px rgba(0, 0, 0, 0.12));
}

:global(.version-menu-item) {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 36px;
  padding: 0.375rem 0.625rem;
  border: none;
  border-radius: 7px;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-primary, #1f2937);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
  white-space: nowrap;
}

:global(.version-menu-item:hover) {
  background: var(--color-bg-hover, #f3f4f6);
}

:global(.version-menu-item.active) {
  color: var(--color-accent-primary, #2A1111);
  background: var(--color-accent-primary-light, rgba(42, 17, 17, 0.08));
  font-weight: 600;
}

:global(.version-menu-fade-enter-active),
:global(.version-menu-fade-leave-active) {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

:global(.version-menu-fade-enter-from),
:global(.version-menu-fade-leave-to) {
  opacity: 0;
  transform: translateY(-4px);
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  padding-bottom: calc(var(--reader-tabs-height, 0px) + var(--reader-controls-height, 0px) + 12px);
}

/* 두 컬럼 모두 BibleViewer 가 본문 렌더링·스크롤·스타일을 소유한다.
   여기서는 뼈대만 잡고 본문 스타일을 복제하지 않는다. */
.column-content.viewer-content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.column-content.viewer-content :deep(.bible-viewer) {
  flex: 1;
  min-height: 0;
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
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.swap-btn:hover {
  background: var(--primary-light, #eef2ff);
  color: var(--primary-color, #2A1111);
  border-color: var(--primary-color, #2A1111);
}

.theme-dark {
  color: var(--text-primary-dark, #e5e5e5);
  background: var(--color-bg-card-dark, #1f1f1f);
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

@media (max-width: 767px) {
  .compare-columns {
    flex-direction: column;
  }

  .compare-divider {
    width: 100%;
    height: 1px;
    padding: 0;
    padding-left: 0;
  }

  .swap-btn {
    transform: translateY(-50%);
  }

  .compare-column {
    min-height: 0;
  }

  .column-content {
    min-height: 0;
  }
}
</style>
