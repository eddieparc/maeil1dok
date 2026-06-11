<template>
  <section class="quick-access" aria-labelledby="quick-access-title">
    <h2 id="quick-access-title">바로가기</h2>
    <div class="quick-grid">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="quick-card"
        :data-testid="item.testId"
      >
        <component :is="item.icon" :size="24" />
        <span class="quick-title">{{ item.title }}</span>
        <span class="quick-description">{{ item.description }}</span>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import BookIcon from '~/components/icons/BookIcon.vue';
import CalendarIcon from '~/components/icons/CalendarIcon.vue';
import ListIcon from '~/components/icons/ListIcon.vue';
import PlayIcon from '~/components/icons/PlayIcon.vue';

const items = [
  {
    to: '/hasena',
    title: '하세나',
    description: '오늘 말씀 묵상',
    icon: ListIcon,
    testId: 'card-hasena',
  },
  {
    to: '/plans',
    title: '플랜 관리',
    description: '구독과 표시 설정',
    icon: CalendarIcon,
    testId: 'card-plans',
  },
  {
    to: '/bible',
    title: '성경',
    description: '본문 읽기',
    icon: BookIcon,
    testId: 'card-bible',
  },
  {
    to: '/intro',
    title: '성경개론',
    description: '개론 영상 보기',
    icon: PlayIcon,
    testId: 'card-intro',
  },
] as const;
</script>

<style scoped>
.quick-access {
  margin-bottom: 1rem;
}

h2 {
  margin: 0 0 0.75rem;
  color: var(--text-main);
  font-family: var(--font-serif);
  font-size: 1.375rem;
  font-weight: 700;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.quick-card {
  display: flex;
  min-height: 8rem;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1rem;
  color: var(--text-main);
  text-decoration: none;
  background: var(--card-bg);
  border: 1px solid var(--color-border-subtle, rgba(74, 93, 83, 0.12));
  border-radius: 16px;
  box-shadow: var(--paper-shadow);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.quick-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
}

.quick-card :deep(svg) {
  color: var(--accent);
  margin-bottom: 0.2rem;
}

.quick-title {
  font-size: 0.9375rem;
  font-weight: 700;
}

.quick-description {
  color: var(--text-sub);
  font-size: 0.75rem;
  line-height: 1.45;
}
</style>
