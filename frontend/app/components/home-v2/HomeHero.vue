<template>
  <section class="hero-section">
    <p class="greeting">{{ greetingMessage }}</p>
    <h1 class="hero-title">
      {{ timeGreeting }}<br>
      <strong>말씀과 동행하세요</strong>
    </h1>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthService } from '~/composables/useAuthService';

const auth = useAuthService();
const timeGreeting = ref('오늘도,');

const greetingMessage = computed(() => {
  const user = auth.user.value;
  if (!auth.isAuthenticated.value || !user) return '방문자님, 환영합니다';

  const name = user.nickname || user.username || '성도';
  return `${name}님, 안녕하세요`;
});

onMounted(() => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    timeGreeting.value = '새로운 아침,';
  } else if (hour >= 12 && hour < 18) {
    timeGreeting.value = '나른한 오후,';
  } else if (hour >= 18 && hour < 22) {
    timeGreeting.value = '하루를 마무리하며';
  } else {
    timeGreeting.value = '평안한 밤,';
  }
});
</script>

<style scoped>
.hero-section {
  margin: 2rem 0 1rem;
}

.greeting {
  margin: 0 0 0.5rem;
  color: var(--text-sub);
  font-size: 1rem;
}

.hero-title {
  margin: 0;
  color: var(--text-main);
  font-family: var(--font-serif);
  font-size: 2.35rem;
  font-weight: 300;
  line-height: 1.3;
}

.hero-title strong {
  font-weight: 700;
}

@media (max-width: 480px) {
  .hero-title {
    font-size: 2rem;
  }
}
</style>
