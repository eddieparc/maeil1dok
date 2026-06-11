<template>
  <section class="card-stack">
    <button class="reading-card main-card" type="button" @click="goPrimary">
      <div class="card-header">
        <span class="card-label">{{ isAuthenticated ? "TODAY'S READING" : 'WELCOME' }}</span>
      </div>

      <h2 class="bible-verse">
        <template v-if="isAuthenticated">오늘의 말씀을<br>이어 읽어보세요</template>
        <template v-else>로그인하고<br>시작하세요</template>
      </h2>

      <p class="chapter-range">
        {{ isAuthenticated ? '나의 통독표와 읽기 기록을 확인할 수 있습니다' : '나만의 통독 기록을 관리할 수 있습니다' }}
      </p>

      <span class="start-btn">
        {{ isAuthenticated ? '통독 시작하기' : '로그인 / 회원가입' }}
        <ArrowRightIcon size="16" />
      </span>
    </button>

    <div class="card-shadow-1"></div>
    <div class="card-shadow-2"></div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthService } from '~/composables/useAuthService';
import ArrowRightIcon from '~/components/icons/ArrowRightIcon.vue';

const router = useRouter();
const auth = useAuthService();
const isAuthenticated = computed(() => auth.isAuthenticated.value);

const goPrimary = (): void => {
  router.push(isAuthenticated.value ? '/bible' : '/login');
};
</script>

<style scoped>
.card-stack {
  position: relative;
  margin-bottom: 3rem;
}

.reading-card {
  width: 100%;
  min-height: 260px;
  border: 1px solid rgba(0, 0, 0, 0.02);
  border-radius: 24px;
  background: var(--card-bg);
  box-shadow: var(--paper-shadow);
  color: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  padding: 2.25rem 2rem;
  position: relative;
  text-align: left;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  z-index: 10;
}

.reading-card:hover {
  box-shadow: 0 12px 30px rgba(44, 51, 51, 0.08);
  transform: translateY(-3px);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.card-label {
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.bible-verse {
  color: var(--text-main);
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 500;
  line-height: 1.22;
  margin: 0 0 0.75rem;
}

.chapter-range {
  color: var(--text-sub);
  font-size: 1rem;
  line-height: 1.5;
  margin: 0 0 2rem;
}

.start-btn {
  align-items: center;
  align-self: flex-start;
  border-bottom: 1px solid currentColor;
  color: var(--text-main);
  display: inline-flex;
  font-size: 1rem;
  font-weight: 600;
  gap: 0.4rem;
  padding-bottom: 4px;
}

.card-shadow-1,
.card-shadow-2 {
  background: var(--card-bg);
  border-radius: 24px;
  box-shadow: var(--paper-shadow);
  height: 100%;
  position: absolute;
}

.card-shadow-1 {
  inset: 10px 20px auto;
  opacity: 0.5;
  z-index: 5;
}

.card-shadow-2 {
  inset: 20px 40px auto;
  opacity: 0.3;
  z-index: 1;
}
</style>
