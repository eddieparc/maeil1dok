<template>
  <section class="reading-card-stack" aria-label="오늘 통독 바로가기">
    <NuxtLink to="/bible" class="primary-card">
      <div>
        <p class="card-kicker">오늘일독</p>
        <h2>오늘 읽을 말씀으로 이동</h2>
        <p>일독 화면에서 본문을 읽고 완료 기록을 남길 수 있어요.</p>
      </div>
      <ArrowRightIcon :size="22" />
    </NuxtLink>
  </section>
</template>

<script setup lang="ts">
import ArrowRightIcon from '~/components/icons/ArrowRightIcon.vue';
</script>

<style scoped>
.reading-card-stack {
  width: 100%;
}

.primary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.125rem;
  color: var(--text-main);
  text-decoration: none;
  background: var(--card-bg);
  border: 1px solid var(--color-border-subtle, rgba(74, 93, 83, 0.12));
  border-radius: 16px;
  box-shadow: var(--paper-shadow);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.primary-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
}

.card-kicker {
  margin: 0 0 0.35rem;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 700;
}

h2 {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
}

p {
  margin: 0.35rem 0 0;
  color: var(--text-sub);
  font-size: 0.8125rem;
  line-height: 1.5;
}
</style>
