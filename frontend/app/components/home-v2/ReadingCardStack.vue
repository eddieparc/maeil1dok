<template>
  <section class="reading-card" aria-label="오늘 읽기">
    <div v-if="isAuthenticated" class="today-reading">
      <template v-if="loading">
        <Skeleton :width="88" circle class="progress-skeleton" />
        <div class="reading-copy">
          <Skeleton width="120px" height="12px" class="sk-line" />
          <Skeleton width="200px" height="22px" class="sk-line" />
          <Skeleton width="160px" height="13px" class="sk-line" />
        </div>
      </template>
      <template v-else>
        <slot name="progress" :progress="progress" :loading="loading">
          <RingProgress :size="88" :thickness="8" :value="progress" :label="`${progress}%`">
            <span class="ring-label">{{ progress }}<small>%</small></span>
          </RingProgress>
        </slot>
        <div class="reading-copy">
          <p class="card-label">{{ planName || '성경통독' }} · 오늘 읽을 본문</p>
          <h2 class="bible-verse">{{ passage || '말씀을 이어 읽어보세요' }}</h2>
          <p class="chapter-range">{{ description || '나의 통독표와 읽기 기록을 확인할 수 있습니다' }}</p>
        </div>
      </template>
    </div>
    <div v-else class="welcome-copy">
      <p class="card-label">WELCOME</p>
      <h2 class="bible-verse">로그인하고<br>시작하세요</h2>
      <p class="chapter-range">나만의 통독 기록을 관리할 수 있습니다</p>
    </div>
    <UiAppButton variant="primary" size="lg" block class="continue-button" @click="goPrimary">{{ isAuthenticated ? '이어 읽기' : '로그인 / 회원가입' }}</UiAppButton>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useLandingAuthState } from '~/composables/useLandingAuthState';
import RingProgress from '~/components/ui/RingProgress.vue';
import Skeleton from '~/components/ui/Skeleton.vue';

withDefaults(defineProps<{
  progress?: number;
  planName?: string;
  passage?: string;
  description?: string;
  loading?: boolean;
}>(), { progress: 0, planName: '', passage: '', description: '', loading: false });

const router = useRouter();
const { isKnownAuthenticated } = useLandingAuthState();
const isAuthenticated = computed(() => isKnownAuthenticated.value);
const goPrimary = (): void => {
  router.push(isAuthenticated.value ? '/bible' : '/login');
};
</script>

<style scoped>
.reading-card {
  padding: var(--card-padding);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-card);
  background: var(--color-bg-card);
  box-shadow: var(--shadow-card);
}
.today-reading { display: flex; align-items: center; gap: 20px; }
.reading-copy { min-width: 0; }
.card-label { margin: 0 0 6px; color: var(--color-accent-primary); font-size: 12px; font-weight: 600; line-height: 1.4; }
.bible-verse { margin: 0 0 6px; color: var(--color-text-primary); font-family: var(--font-serif); font-size: 20px; font-weight: 700; line-height: 1.3; letter-spacing: var(--tracking-display); }
.chapter-range { margin: 0; color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; }
.ring-label { font-size: 24px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: var(--tracking-display); }
.ring-label small { margin-left: 1px; font-size: 13px; font-weight: 600; }
.continue-button { margin-top: 20px; height: 44px; box-shadow: none; }
.progress-skeleton { flex-shrink: 0; }
.sk-line { display: block; margin-bottom: 8px; }
.sk-line:last-child { margin-bottom: 0; }
.welcome-copy { padding-block: 8px; }
@media (min-width: 1024px) {
  .reading-card { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; }
  .today-reading { flex: 1 1 300px; min-width: 0; }
  .bible-verse { font-size: 26px; }
  .continue-button { width: auto; flex: 0 0 auto; margin-top: 0; margin-left: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .reading-card { animation: none; }
}
</style>
