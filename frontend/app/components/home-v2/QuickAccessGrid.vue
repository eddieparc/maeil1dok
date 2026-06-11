<template>
  <section class="quick-access">
    <h3 class="section-title">Explore</h3>

    <div class="grid-2">
      <NuxtLink to="/hasena" class="sub-card" data-testid="card-hasena">
        <ListIcon size="24" />
        <strong>하세나하시조</strong>
        <span>오늘 말씀 묵상</span>
      </NuxtLink>

      <NuxtLink to="/plan" class="sub-card">
        <CalendarIcon size="24" />
        <strong>통독표</strong>
        <span>전체 계획 보기</span>
      </NuxtLink>

      <NuxtLink to="/plans" class="sub-card" data-testid="card-plans">
        <SettingsIcon size="24" />
        <strong>플랜 관리</strong>
        <span>구독과 표시 설정</span>
      </NuxtLink>

      <NuxtLink to="/bible" class="sub-card" data-testid="card-bible">
        <BookIcon size="24" />
        <strong>성경</strong>
        <span>본문 읽기</span>
      </NuxtLink>

      <NuxtLink to="/intro" class="sub-card">
        <MonitorIcon size="24" />
        <strong>개론 영상</strong>
        <span>깊이 있는 이해</span>
      </NuxtLink>

      <NuxtLink to="/groups" class="sub-card">
        <UsersIcon :size="24" />
        <strong>커뮤니티</strong>
        <span>함께 읽는 기쁨</span>
      </NuxtLink>

      <NuxtLink :to="profileLink" class="sub-card">
        <HistoryIcon size="24" />
        <strong>내 활동</strong>
        <span>기록과 통계</span>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { UsersIcon } from '@lucide/vue';
import { useAuthService } from '~/composables/useAuthService';
import BookIcon from '~/components/icons/BookIcon.vue';
import CalendarIcon from '~/components/icons/CalendarIcon.vue';
import HistoryIcon from '~/components/icons/HistoryIcon.vue';
import ListIcon from '~/components/icons/ListIcon.vue';
import MonitorIcon from '~/components/icons/MonitorIcon.vue';
import SettingsIcon from '~/components/icons/SettingsIcon.vue';

const auth = useAuthService();

const profileLink = computed(() => {
  return auth.user.value ? `/profile/${auth.user.value.id}` : '/login';
});
</script>

<style scoped>
.quick-access {
  margin-bottom: 2rem;
}

.section-title {
  color: var(--text-main);
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
}

.grid-2 {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
}

.sub-card {
  background: var(--card-bg);
  border: 1px solid rgba(0, 0, 0, 0.02);
  border-radius: 20px;
  box-shadow: var(--paper-shadow);
  color: var(--text-main);
  display: grid;
  gap: 0.35rem;
  min-height: 128px;
  padding: 1.4rem;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.sub-card:hover {
  box-shadow: 0 8px 20px rgba(44, 51, 51, 0.06);
  transform: translateY(-2px);
}

.sub-card svg {
  color: var(--text-main);
  margin-bottom: 0.5rem;
}

.sub-card strong {
  font-size: 1rem;
  font-weight: 700;
}

.sub-card span {
  color: var(--text-sub);
  font-size: 0.8125rem;
}

@media (max-width: 480px) {
  .sub-card {
    padding: 1.2rem;
  }
}
</style>
