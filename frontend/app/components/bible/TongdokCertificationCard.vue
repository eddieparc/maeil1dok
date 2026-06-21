<template>
  <article
    class="certification-card"
    :aria-label="accessibleSummary"
  >
    <p class="certification-brand">매일일독</p>
    <div class="certification-mark" aria-hidden="true">
      <CheckIcon :size="40" :stroke-width="2.5" />
    </div>
    <h3 class="certification-title">{{ title }}</h3>
    <p class="certification-copy">{{ subtitle }}</p>
    <dl v-if="readingRange || progressLine" class="certification-detail">
      <div v-if="readingRange" class="certification-detail-row">
        <dt>범위</dt>
        <dd>{{ readingRange }}</dd>
      </div>
      <div v-if="progressLine" class="certification-detail-row">
        <dt>진도</dt>
        <dd>{{ progressLine }}</dd>
      </div>
    </dl>
    <p class="certification-summary sr-only">
      {{ accessibleSummary }}
    </p>
    <footer class="certification-footer">{{ footer }}</footer>
  </article>
</template>

<script setup lang="ts">
import { CheckIcon } from '@lucide/vue';
import { computed } from 'vue';
import type { CertificationProgressPayload } from '~/composables/useCertificationShare';

const props = defineProps<{
  certification?: CertificationProgressPayload | null;
}>();

const title = computed(() => props.certification?.card?.title || '오늘 통독 완료');
const subtitle = computed(() => props.certification?.card?.subtitle || '오늘도 말씀을 읽었습니다');
const footer = computed(() => props.certification?.card?.footer || '매일 말씀을 읽는 작은 습관');
const readingRange = computed(() => props.certification?.card?.readingRange || '');
const progressLine = computed(() => {
  const progress = props.certification?.progress;
  if (!progress || progress.totalSchedules === 0) return '';
  return `${progress.completedSchedules}/${progress.totalSchedules}일 완료 · ${progress.completionRate}%`;
});
const accessibleSummary = computed(() => {
  const parts = ['매일일독', title.value, subtitle.value, readingRange.value, progressLine.value]
    .filter(Boolean);
  return `${parts.join('. ')} 인증 카드.`;
});
</script>

<style scoped>
.certification-card {
  width: min(100%, 320px);
  aspect-ratio: 4 / 5;
  margin: 0 auto;
  padding: var(--spacing-6, 1.5rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  text-align: center;
  color: var(--color-text-primary);
  background:
    linear-gradient(180deg, var(--color-bg-card) 0%, var(--color-bg-tertiary) 100%),
    var(--color-bg-primary);
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
}

.certification-brand {
  margin: 0;
  color: var(--color-accent-primary);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0;
}

.certification-mark {
  width: 88px;
  height: 88px;
  display: grid;
  place-items: center;
  color: #ffffff;
  background: var(--color-accent-primary);
  border-radius: 50%;
}

.certification-title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0;
}

.certification-copy,
.certification-footer {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.9375rem;
  line-height: 1.6;
  letter-spacing: 0;
}

.certification-detail {
  width: 100%;
  display: grid;
  gap: var(--spacing-1, 0.25rem);
  margin: 0;
  padding: var(--spacing-3, 0.75rem) 0;
  border-top: 1px solid var(--color-border-default);
  border-bottom: 1px solid var(--color-border-default);
}

.certification-detail-row {
  display: grid;
  gap: 0.125rem;
}

.certification-detail dt,
.certification-detail dd {
  margin: 0;
  letter-spacing: 0;
}

.certification-detail dt {
  color: var(--color-text-tertiary, var(--color-text-secondary));
  font-size: 0.75rem;
  font-weight: 600;
}

.certification-detail dd {
  color: var(--color-text-primary);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.35;
}

.certification-footer {
  font-size: 0.8125rem;
  font-weight: 500;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
