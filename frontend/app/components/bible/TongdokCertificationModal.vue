<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ShareSheet from '~/components/bible/share/ShareSheet.vue';
import { useApi } from '~/composables/useApi';
import type { BibleShareMetadata } from '~/composables/bible/bibleShare';
import type { components } from '~/types/generated/api-schema';

const props = defineProps<{ modelValue: boolean; planId?: number | null; scheduleId?: number | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; close: [] }>();
const api = useApi();
const certification = ref<components['schemas']['CertificationProgressResponse'] | null>(null);
const isLoading = ref(false);
const errorMessage = ref('');
const retry = ref(0);
const metadata = computed<BibleShareMetadata>(() => {
  const value = certification.value;
  if (!value) return {};
  const progress = value.progress;
  return {
    nickname: value.user.nickname,
    planName: value.plan.name,
    dateLabel: value.card.dateLabel,
    readingRange: value.card.readingRange,
    streak: progress.currentStreak,
    progress: progress.totalSchedules > 0 ? { completed: progress.completedSchedules, total: progress.totalSchedules, percent: progress.completionRate } : undefined,
  };
});
const shareUrl = computed(() => {
  const params = new URLSearchParams({ certification: 'tongdok' });
  if (props.planId) params.set('plan_id', String(props.planId));
  if (props.scheduleId) params.set('schedule_id', String(props.scheduleId));
  if (metadata.value.dateLabel) params.set('date', metadata.value.dateLabel);
  const origin = typeof window === 'undefined' ? 'https://maeil1dok.app' : window.location.origin;
  return `${origin}/bible/history?${params}`;
});

watch(() => [props.modelValue, props.planId, props.scheduleId, retry.value] as const, async ([open], _, onCleanup) => {
  let current = true;
  onCleanup(() => { current = false; });
  certification.value = null;
  errorMessage.value = '';
  isLoading.value = open;
  if (!open) return;
  try {
    const response = await api.GET('/api/v1/todos/certification/progress/', { params: { plan_id: props.planId ?? undefined, schedule_id: props.scheduleId ?? undefined } });
    if (!current) return;
    if (!response.data.success || !['no_progress', 'in_progress', 'completed'].includes(response.data.progress.status)) throw new Error('인증 정보를 불러오지 못했습니다.');
    if (props.planId && response.data.plan.id !== props.planId) throw new Error('요청한 플랜의 인증 정보가 아닙니다.');
    certification.value = response.data;
  } catch (error) {
    if (current) errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (current) isLoading.value = false;
  }
}, { immediate: true });
</script>

<template>
  <ShareSheet :model-value="modelValue" mode="complete" :metadata="metadata" :verses="[]" :loading="isLoading || !certification" :share-url="shareUrl" :plan-id="planId" :schedule-id="scheduleId" @update:model-value="emit('update:modelValue', $event)" @close="emit('close')">
    <template #status>
      <div v-if="errorMessage" role="alert" class="certification-status">
        <p>{{ errorMessage }}</p>
        <button type="button" @click="retry++">다시 시도</button>
      </div>
    </template>
  </ShareSheet>
</template>

<style scoped>
.certification-status { text-align: center; color: var(--color-text-secondary); font-size: 13px; }
.certification-status button { min-height: 44px; padding: 0 18px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-card); color: var(--color-accent-primary); }
.certification-status button:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
</style>
