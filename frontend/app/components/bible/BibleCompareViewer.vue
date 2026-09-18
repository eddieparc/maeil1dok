<template>
  <!-- 비교 비활성: primary 슬롯만 렌더 -->
  <slot v-if="enabled === false" name="primary" />
  <div v-else class="bible-compare-viewer" :class="[`theme-${effectiveTheme}`]">
    <!-- 단일 헤더: 두 역본 선택 + 교체. 본문은 슬롯의 BibleViewer 하나가
         절 단위 병합 DOM을 렌더하므로 스크롤·선택·하이라이트가 그대로 동작한다. -->
    <div ref="headerRef" class="compare-header">
      <template v-for="item in headerItems" :key="item.key">
        <button
          v-if="item.type === 'version'"
          class="version-btn"
          :aria-expanded="openMenu === item.role"
          aria-haspopup="listbox"
          @click.stop="toggleMenu(item.role, $event)"
        >
          {{ item.name }} <ChevronDownIcon :size="14" />
        </button>
        <button
          v-else
          class="swap-btn"
          :disabled="swapLocked"
          aria-label="역본 교체"
          @click="handleSwapClick"
        >
          <SwapIcon :size="16" :style="{ transform: `rotate(${swapRotation}deg)` }" />
        </button>
      </template>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
const headerRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});

// 스왑 시 두 버튼이 실제로 자리를 바꾸도록 버전을 DOM 순서로 렌더한다.
// 역할(primary/secondary)은 위치가 결정하고, 버튼은 버전에 귀속된다.
// 스왑 중에는 표시 쌍을 얼려 둔다 — primary prop이 비동기로 늦게 도착해도
// 낙관적 순서가 중간에 되돌아가지 않는다.
interface VersionSlot {
  code: string;
  name: string;
}

const propVersions = (): [VersionSlot, VersionSlot] => [
  { code: props.primaryVersionCode ?? '', name: props.primaryVersionName ?? '' },
  { code: props.secondaryVersionCode ?? '', name: props.secondaryVersionName ?? '' },
];

const displayVersions = ref<[VersionSlot, VersionSlot]>(propVersions());
const swapLocked = ref(false);
const swapRotation = ref(0);
const swapFrozen = ref(false);
let swapSettleTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => [props.primaryVersionCode, props.primaryVersionName, props.secondaryVersionCode, props.secondaryVersionName],
  () => {
    const [primary, secondary] = propVersions();
    const [shownPrimary, shownSecondary] = displayVersions.value;
    // 스왑 대기 중: 기대한 최종 쌍이 도착했을 때만 동기화한다.
    // secondary는 동기적으로, primary는 라우터 탐색 뒤에 도착하므로
    // 중간 상태(두 버튼이 같은 역본)가 표시되지 않게 얼려 둔다.
    if (swapFrozen.value) {
      if (shownPrimary.code === primary.code && shownSecondary.code === secondary.code) {
        swapFrozen.value = false;
        if (swapSettleTimer) { clearTimeout(swapSettleTimer); swapSettleTimer = null; }
        displayVersions.value = [primary, secondary];
      }
      return;
    }
    displayVersions.value = [primary, secondary];
  },
);

interface HeaderItem {
  key: string;
  type: 'version' | 'swap';
  role: CompareColumn;
  code: string;
  name: string;
}

const headerItems = computed<HeaderItem[]>(() => {
  const items: HeaderItem[] = [];
  displayVersions.value.forEach((version, index) => {
    items.push({
      key: version.code ? `v-${version.code}` : `v-${index}`,
      type: 'version',
      role: index === 0 ? 'primary' : 'secondary',
      code: version.code,
      name: version.name,
    });
    if (index === 0) items.push({ key: 'swap', type: 'swap', role: 'primary', code: '', name: '' });
  });
  return items;
});

const versionButtons = () =>
  Array.from(headerRef.value?.querySelectorAll<HTMLElement>('.version-btn') ?? []);

const handleSwapClick = async () => {
  if (swapLocked.value) return;
  swapLocked.value = true;
  closeMenu();
  const before = new Map(versionButtons().map(el => [el, el.getBoundingClientRect()]));
  // 낙관적 순서 교체: 버튼이 즉시 자리를 바꾸고 FLIP으로 이동한다.
  // emit 전에 얼려야 부모의 동기 prop 갱신이 중간 상태를 밀어 넣지 않는다.
  swapFrozen.value = true;
  displayVersions.value = [displayVersions.value[1], displayVersions.value[0]];
  swapRotation.value += 180;
  emit('swap');
  await nextTick();
  for (const el of versionButtons()) {
    const from = before.get(el);
    if (!from) continue;
    const to = el.getBoundingClientRect();
    const dx = from.left - to.left;
    if (!dx) continue;
    el.animate(
      [{ transform: `translateX(${dx}px)`, zIndex: '1' }, { transform: 'translateX(0)', zIndex: '1' }],
      { duration: 220, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    );
  }
  window.setTimeout(() => { swapLocked.value = false; }, 240);
  // 최종 props가 오면 watcher가 동기화한다. 오지 않으면 3초 뒤 실제 값으로 복귀.
  if (swapSettleTimer) clearTimeout(swapSettleTimer);
  swapSettleTimer = setTimeout(() => {
    swapSettleTimer = null;
    swapFrozen.value = false;
    displayVersions.value = propVersions();
  }, 3000);
};

const activeVersionCode = computed(() =>
  openMenu.value === 'primary' ? props.primaryVersionCode : props.secondaryVersionCode);

const toggleMenu = (column: CompareColumn, event: MouseEvent) => {
  if (openMenu.value === column) { openMenu.value = null; return; }
  const btn = event.currentTarget as HTMLElement | null;
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
  if (swapSettleTimer) clearTimeout(swapSettleTimer);
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

.swap-btn:disabled {
  cursor: default;
  opacity: 0.7;
}

.swap-btn :deep(svg) {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  .swap-btn :deep(svg) {
    transition-duration: 0.12s;
  }
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
