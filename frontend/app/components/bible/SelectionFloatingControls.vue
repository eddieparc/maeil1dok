<template>
  <div
    v-if="state.mode === 'action'"
    data-testid="selection-action-menu"
    class="selection-floating-stack selection-action-menu"
    role="toolbar"
    aria-label="선택한 구절 작업"
    @click.stop
  >
    <button class="selection-action-button" @click="$emit('highlight-or-remove')">
      <PenIcon :size="16" aria-hidden="true" />
      <span>{{ state.isHighlighted ? '제거' : '하이라이트' }}</span>
    </button>
    <button class="selection-action-button" @click="$emit('copy')">
      <CopyIcon :size="16" aria-hidden="true" />
      <span>복사</span>
    </button>
    <button class="selection-action-button" @click="$emit('share')">
      <ShareIcon :size="16" aria-hidden="true" />
      <span>공유</span>
    </button>
    <button class="selection-action-button close" aria-label="선택 메뉴 닫기" @click="$emit('close')">
      <XMarkIcon :size="16" aria-hidden="true" />
    </button>
  </div>

  <div
    v-else-if="state.mode === 'copy'"
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
import { CopyIcon, PenIcon, ShareIcon } from '@lucide/vue';
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
  max-width: min(400px, calc(100vw - 32px));
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.selection-action-menu {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.375rem 0.5rem;
  background: var(--color-bg-card, #fff);
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 999px;
  box-shadow:
    0 18px 40px rgba(31, 41, 55, 0.16),
    0 6px 16px rgba(31, 41, 55, 0.12);
}

.selection-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  min-height: 36px;
  padding: 0.5rem 0.75rem;
  color: var(--text-primary, #1f2937);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 999px;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.selection-action-button svg {
  color: var(--text-secondary, #6b7280);
}

.selection-action-button:hover {
  background: var(--color-bg-hover, #f3f4f6);
}

.selection-action-button:active {
  transform: scale(0.96);
}

.selection-action-button.close {
  width: 36px;
  padding: 0;
  color: var(--text-secondary, #6b7280);
}

.selection-copy-menu {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  width: max-content;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 16px;
  box-shadow:
    0 18px 40px rgba(31, 41, 55, 0.16),
    0 6px 16px rgba(31, 41, 55, 0.12);
}

.selection-copy-label {
  flex-shrink: 0;
  color: var(--primary-color, #6366f1);
  font-size: 0.875rem;
  font-weight: 700;
  white-space: nowrap;
}

.selection-copy-buttons {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
}

.selection-copy-button {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.25rem 0.5rem;
  color: var(--text-secondary, #6b7280);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 8px;
  transition: background 0.2s ease, color 0.2s ease;
}

.selection-copy-button:hover {
  color: var(--text-primary, #1f2937);
  background: var(--color-bg-hover, #f3f4f6);
}

.selection-copy-button.close {
  color: var(--color-error);
  padding: 0.25rem;
}

.selection-action-divider {
  color: var(--color-border, #d1d5db);
  font-size: 0.75rem;
}

@media (max-width: 360px) {
  .selection-action-menu {
    width: calc(100vw - 32px);
    justify-content: space-between;
  }

  .selection-action-button {
    gap: 0.25rem;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    font-size: 0.75rem;
  }

  .selection-action-button.close {
    width: 32px;
  }

  .selection-copy-menu {
    width: calc(100vw - 32px);
    gap: 0.5rem;
  }

  .selection-copy-label {
    font-size: 0.8125rem;
  }

  .selection-copy-buttons {
    flex: 1;
    justify-content: space-between;
  }

  .selection-copy-button {
    padding-left: 0.25rem;
    padding-right: 0.25rem;
    font-size: 0.75rem;
  }
}
</style>
