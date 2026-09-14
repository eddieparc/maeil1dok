<template>
  <section class="hero-section">
    <p v-if="displayUser" class="greeting">{{ dateCaption }}</p>
    <p v-else class="greeting">방문자님, 환영합니다</p>
    <h1 class="hero-title">
      <template v-if="displayUser">{{ displayUser.nickname || displayUser.username || '성도' }}님<template v-if="streak !== null && streak > 0">, {{ streak }}일째</template><br>이어가고 있어요</template>
      <template v-else>말씀과 함께<br>시작해보세요</template>
    </h1>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useLandingAuthState } from '~/composables/useLandingAuthState';

withDefaults(defineProps<{ streak?: number | null }>(), { streak: null });
const { displayUser: landingUser } = useLandingAuthState();
const displayUser = computed(() => landingUser.value);
const dateCaption = useState('home:dateCaption', () => new Intl.DateTimeFormat('ko-KR', {
  month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date()));
</script>

<style scoped>
.hero-section { padding-block: 20px 4px; }
.greeting { margin: 0 0 8px; color: var(--color-text-secondary); font-size: 14px; line-height: 1.5; }
.hero-title { margin: 0; color: var(--color-text-primary); font-family: var(--font-serif); font-size: 26px; font-weight: 700; line-height: 1.3; letter-spacing: var(--tracking-display); }
@media (min-width: 1024px) {
  .hero-title { font-size: 30px; line-height: 1.25; letter-spacing: -0.8px; }
}
@media (prefers-reduced-motion: reduce) {
  .hero-section { animation: none; }
}
</style>
