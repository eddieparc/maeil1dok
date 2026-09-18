<template>
  <!-- 비교 비활성: primary 슬롯만 렌더 -->
  <slot v-if="enabled === false" name="primary" />
  <div v-else class="bible-compare-viewer" :class="[`theme-${effectiveTheme}`]">
    <!-- 단일 헤더: 두 역본 선택 + 교체. 본문은 슬롯의 BibleViewer 하나가
         절 단위 병합 DOM을 렌더하므로 스크롤·선택·하이라이트가 그대로 동작한다. -->
    <div class="compare-header">
      <button
        ref="primaryBtnRef"
        class="version-btn"
        :aria-expanded="openMenu === 'primary'"
        aria-haspopup="listbox"
        @click.stop="toggleMenu('primary')"
      >
        {{ primaryVersionName }} <ChevronDownIcon :size="14" />
      </button>
      <button class="swap-btn" @click="$emit('swap')" aria-label="역본 교체">
        <SwapIcon :size="16" />
      </button>
      <button
        ref="secondaryBtnRef"
        class="version-btn"
        :aria-expanded="openMenu === 'secondary'"
        aria-haspopup="listbox"
        @click.stop="toggleMenu('secondary')"
      >
        {{ secondaryVersionName }} <ChevronDownIcon :size="14" />
      </button>
      <span v-if="isSecondaryLoading" class="compare-loading">불러오는 중…</span>
    </div>
    <div class="compare-body">
      <slot name="primary" />
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
import { ChevronDown as ChevronDownIcon, ArrowLeftRight as SwapIcon } from '@lucide/vue';
import { useReadingSettingsStore } from '~/stores/readingSettings';
import { VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';

const props = defineProps<{
  enabled?: boolean;
  primaryVersionName?: string;
  secondaryVersionName?: string;
  primaryVersionCode?: string;
  secondaryVersionCode?: string;
  isSecondaryLoading?: boolean;
}>();

const emit = defineEmits<{
  'version-select': [column: 'primary' | 'secondary', version: string];
  'swap': [];
}>();

const settingsStore = useReadingSettingsStore();
const effectiveTheme = computed(() => settingsStore.effectiveTheme);

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
</style>
