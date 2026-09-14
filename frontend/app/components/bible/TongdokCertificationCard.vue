<script setup lang="ts">
import { computed } from 'vue';
import ShareCardSummary from '~/components/bible/share/ShareCardSummary.vue';
import type { CertificationProgressPayload } from '~/composables/useCertificationShare';
import type { BibleShareMetadata } from '~/composables/bible/bibleShare';

const props = defineProps<{ certification?: CertificationProgressPayload | null }>();
const metadata = computed<BibleShareMetadata>(() => {
  const value = props.certification;
  const progress = value?.progress;
  return {
    nickname: value?.user?.nickname,
    planName: value?.plan?.name,
    readingRange: value?.card?.readingRange,
    dateLabel: value?.card?.dateLabel,
    streak: progress?.currentStreak,
    progress: progress && progress.totalSchedules > 0 ? { completed: progress.completedSchedules, total: progress.totalSchedules, percent: progress.completionRate } : undefined,
  };
});
const title = computed(() => props.certification?.card?.title || '오늘 통독 완료');
const subtitle = computed(() => props.certification?.card?.subtitle || '오늘도 말씀을 읽었습니다');
const footer = computed(() => props.certification?.card?.footer || '매일 말씀을 읽는 작은 습관');
const readingRange = computed(() => props.certification?.card?.readingRange || '');
const progressLine = computed(() => {
  const progress = props.certification?.progress;
  return progress && progress.totalSchedules > 0 ? `${progress.completedSchedules}/${progress.totalSchedules}일 완료 · ${progress.completionRate}%` : '';
});
const accessibleSummary = computed(() => `${['매일일독', title.value, subtitle.value, readingRange.value, progressLine.value].filter(Boolean).join('. ')} 인증 카드.`);
</script>

<template>
  <article class="certification-card" :aria-label="accessibleSummary">
    <ShareCardSummary :metadata="metadata" format="in-app" aria-hidden="true" />
    <p class="sr-only">{{ accessibleSummary }} {{ footer }}</p>
  </article>
</template>

<style scoped>
.certification-card { width: min(100%, 320px); aspect-ratio: 4 / 5; margin: 0 auto; overflow: hidden; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); box-shadow: var(--shadow-sm); }
.certification-card :deep(svg) { width: 100%; height: auto; display: block; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
