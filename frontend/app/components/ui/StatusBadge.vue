<script setup lang="ts">
import type { ReadingStatus } from '~/types/plan'
import { STATUS_TEXT } from '~/types/plan'

defineProps<{ status: ReadingStatus }>()
</script>

<template>
  <span class="status-badge" :class="`status-badge--${status}`">{{ STATUS_TEXT[status] }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: var(--tracking-body);
  white-space: nowrap;
}
.status-badge--completed { background: var(--color-accent-bg); color: var(--color-accent-primary); }
.status-badge--current { background: var(--color-accent-primary); color: var(--color-text-inverse); }
.status-badge--not_completed { background: var(--color-error-bg); color: var(--color-error); }
.status-badge--upcoming { border-color: var(--color-border-default); color: var(--color-text-tertiary); }
[data-theme="dark"] .status-badge--completed { background: transparent; border: 1.5px solid var(--color-accent-primary); }
</style>
