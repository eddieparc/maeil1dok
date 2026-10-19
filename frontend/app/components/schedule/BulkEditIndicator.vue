<script setup lang="ts">
import { Check, X } from '@lucide/vue';
import AppButton from '~/components/ui/AppButton.vue';
import type { BulkEditState, ReadingAction } from '~/types/plan';
defineProps<{ show: boolean; state: BulkEditState; disabled?: boolean }>();
defineEmits<{ action: [action: ReadingAction] }>();
</script>
<template>
  <div v-if="show" class="bulk-edit-indicator" :data-stage="state.secondSchedule ? 2 : state.firstSchedule ? 1 : 0" :aria-busy="disabled">
    <span class="bulk-edit-message" aria-live="polite">{{ state.message }}</span>
    <div v-if="state.showActions" class="bulk-edit-actions">
      <AppButton size="sm" data-action="complete" :disabled="disabled" @click="$emit('action', 'complete')"><Check :size="16" aria-hidden="true" />읽음</AppButton>
      <AppButton size="sm" variant="secondary" data-action="cancel" :disabled="disabled" @click="$emit('action', 'cancel')"><X :size="16" aria-hidden="true" />읽지 않음</AppButton>
      <span>으로 기록</span>
    </div>
  </div>
</template>
<style scoped>
.bulk-edit-indicator { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px; border: 1px solid var(--color-accent-primary); border-radius: 14px; background: var(--color-accent-bg); color: var(--color-accent-primary); font-size: 13px; }
.bulk-edit-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
</style>
