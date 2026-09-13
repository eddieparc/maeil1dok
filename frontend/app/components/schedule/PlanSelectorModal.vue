<script setup lang="ts">
import { Circle, CircleDot, SlidersHorizontal } from '@lucide/vue';
import BottomSheet from '~/components/ui/BottomSheet.vue';
import AppButton from '~/components/ui/AppButton.vue';
import type { SubscriptionSummary } from '~/types/plan';
defineProps<{ show: boolean; subscriptions: SubscriptionSummary[]; selectedPlanId: number | string | null }>();
defineEmits<{ close: []; select: [subscription: SubscriptionSummary]; manage: [] }>();
</script>
<template>
  <BottomSheet :model-value="show" title="플랜 선택" @update:model-value="!$event && $emit('close')">
    <div class="plan-list" role="group" aria-label="활성 구독 플랜">
      <button v-for="subscription in subscriptions" :key="subscription.plan_id" type="button" class="plan-item"
        :class="{ active: Number(selectedPlanId) === subscription.plan_id }" :aria-pressed="Number(selectedPlanId) === subscription.plan_id"
        :data-plan="subscription.plan_id" @click="$emit('select', subscription)">
        <CircleDot v-if="Number(selectedPlanId) === subscription.plan_id" :size="20" aria-hidden="true" /><Circle v-else :size="20" aria-hidden="true" />
        <span class="plan-name">{{ subscription.plan_name }}</span><span v-if="subscription.is_default" class="default-badge">기본</span>
      </button>
      <p v-if="!subscriptions.length" class="empty-plans">표시할 활성 플랜이 없어요.</p>
    </div>
    <template #footer><div class="sheet-actions">
      <AppButton variant="secondary" block @click="$emit('close')">취소</AppButton>
      <AppButton block @click="$emit('manage')"><SlidersHorizontal :size="16" aria-hidden="true" />플랜 관리</AppButton>
    </div></template>
  </BottomSheet>
</template>
<style scoped>
.plan-list { display: grid; gap: 8px; }
.plan-item { display: flex; align-items: center; gap: 10px; width: 100%; min-width: var(--hit-min); min-height: 48px; padding: 12px 14px; border: 1px solid var(--color-border-default); border-radius: 14px; background: var(--color-bg-card); color: var(--color-text-primary); text-align: left; cursor: pointer; transition: background-color .15s, transform .15s; }
.plan-item svg { flex-shrink: 0; color: var(--color-text-tertiary); }
.plan-item.active { background: var(--color-accent-bg); border-color: var(--color-accent-primary); }
.plan-item.active svg { color: var(--color-accent-primary); }
.plan-name { flex: 1; font-size: 14px; font-weight: 600; }
.default-badge { padding: 4px 8px; border-radius: var(--radius-pill); background: var(--color-accent-bg); color: var(--color-accent-primary); font-size: 11px; }
.sheet-actions { display: flex; gap: 8px; }
.empty-plans { color: var(--color-text-secondary); font-size: 14px; }
.plan-item:hover { background: var(--color-accent-bg); }
.plan-item:active { transform: scale(.97); }
@media (prefers-reduced-motion: reduce) { .plan-item { transition: none; } .plan-item:active { transform: none; } }
</style>
