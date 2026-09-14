<template>
  <div
    v-if="state.visible && state.mode === 'action'"
    data-testid="selection-action-menu"
    class="selection-floating-stack selection-action-menu"
    role="toolbar"
    aria-label="선택한 구절 작업"
    @click.stop
    @mousedown.prevent
    @keydown.esc.stop="$emit('close')"
  >
    <span v-if="state.selection" class="selection-location">
      {{ state.selection.chapter }}:{{ state.selection.start }}<template v-if="state.selection.end !== state.selection.start">-{{ state.selection.end }}</template>
    </span>
    <div class="selection-palette" role="group" aria-label="하이라이트 색상">
      <button
        v-for="color in DEFAULT_HIGHLIGHT_COLORS"
        :key="color.value"
        type="button"
        class="selection-color-button"
        :data-color="color.value"
        :aria-label="`${color.name} 하이라이트 저장`"
        @click="$emit('highlight-color', color.value)"
      >
        <span class="selection-swatch" :style="{ backgroundColor: color.value }" aria-hidden="true"></span>
      </button>
    </div>
    <button v-if="state.isHighlighted" type="button" class="selection-action-button selection-delete-button" aria-label="하이라이트 삭제" @click="$emit('highlight-or-remove')">
      <span class="selection-delete-swatch" :style="{ backgroundColor: state.highlightColor || 'var(--color-accent-primary, #2A1111)' }" aria-hidden="true">
        <XMarkIcon :size="11" />
      </span>
    </button>
    <button type="button" class="selection-action-button selection-copy-action" aria-label="구절 복사" @click="$emit('copy')">
      <CopyIcon :size="16" aria-hidden="true" />
      <span>복사</span>
    </button>
    <button type="button" class="selection-action-button selection-share-action" aria-label="구절 공유" @click="$emit('share')">
      <ShareIcon :size="16" aria-hidden="true" />
      <span>공유</span>
    </button>
    <button type="button" class="selection-action-button close selection-close-action" aria-label="선택 메뉴 닫기" @click="$emit('close')">
      <XMarkIcon :size="16" aria-hidden="true" />
    </button>
  </div>

  <div
    v-else-if="state.visible && state.mode === 'copy'"
    data-testid="selection-copy-menu"
    class="selection-floating-stack selection-copy-menu"
    role="toolbar"
    aria-label="선택한 구절 복사 형식"
    @click.stop
  >
    <span class="selection-copy-label">{{ state.isSingleVerse ? '복사' : '구간 복사' }}</span>
    <div class="selection-copy-buttons">
      <template v-if="state.isSingleVerse">
        <button class="selection-copy-button" @click="$emit('copy-format', 'includeLocation')">
          위치 포함
        </button>
        <span class="selection-action-divider">|</span>
        <button class="selection-copy-button" @click="$emit('copy-format', 'numOnly')">
          절 번호만
        </button>
        <span class="selection-action-divider">|</span>
        <button class="selection-copy-button" @click="$emit('copy-format', 'textOnly')">
          내용만
        </button>
      </template>
      <template v-else>
        <button class="selection-copy-button" @click="$emit('copy-format', 'includeLocationRange')">
          위치 포함
        </button>
        <span class="selection-action-divider">|</span>
        <button class="selection-copy-button" @click="$emit('copy-format', 'excludeLocationRange')">
          절 번호만
        </button>
      </template>
      <button class="selection-copy-button close" aria-label="복사 메뉴 닫기" @click="$emit('copy-close')">
        <XMarkIcon :size="14" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CopyIcon, ShareIcon } from '@lucide/vue';
import { DEFAULT_HIGHLIGHT_COLORS } from '~/composables/useHighlight';
import type { SelectionMenuState } from '~/components/bible/BibleViewer.vue';
import XMarkIcon from '~/components/icons/XMarkIcon.vue';

export type SelectionCopyFormat =
  | 'includeLocation'
  | 'numOnly'
  | 'textOnly'
  | 'includeLocationRange'
  | 'excludeLocationRange';

defineProps<{
  state: SelectionMenuState;
}>();

defineEmits<{
  'highlight-or-remove': [];
  'highlight-color': [color: string];
  copy: [];
  share: [];
  close: [];
  'copy-format': [format: SelectionCopyFormat];
  'copy-close': [];
}>();
</script>

<style scoped>
.selection-floating-stack {
  margin: 0 auto;
  width: calc(100% - 24px);
  max-width: 520px;
  font-family: var(--font-sans);
  letter-spacing: var(--tracking-body);
  color: var(--color-apple-text);
  background: var(--color-apple-bg);
  border-radius: 14px;
  box-shadow: var(--shadow-lg);
}

.selection-action-menu {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 6px;
}

.selection-location {
  flex: 1 0 auto;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.selection-palette {
  display: flex;
}

.selection-action-button,
.selection-color-button,
.selection-copy-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  padding: 0 6px;
  gap: 6px;
  color: var(--color-apple-text);
  background: transparent;
  border: 0;
  border-radius: var(--radius-control);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}

.selection-swatch {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-pill);
}

.selection-delete-swatch {
  position: relative;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-pill);
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
}

.selection-delete-swatch svg {
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.55));
}

.selection-action-button:hover,
.selection-color-button:hover,
.selection-copy-button:hover {
  background: color-mix(in srgb, var(--color-apple-text) 12%, transparent);
}

.selection-action-button:focus-visible,
.selection-color-button:focus-visible,
.selection-copy-button:focus-visible {
  outline: 2px solid var(--color-apple-text);
  outline-offset: -2px;
}

.selection-copy-menu,
.selection-copy-buttons {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.selection-copy-menu { padding: 6px 12px; }
.selection-copy-label { font-size: 12px; font-weight: 600; }
.selection-action-divider { opacity: 0.5; }

@media (max-width: 480px) {
  .selection-copy-action span,
  .selection-share-action span { display: none; }
  .selection-location { flex-basis: 100%; padding: 4px 6px; }
  .selection-palette { margin-right: auto; }
}
</style>
