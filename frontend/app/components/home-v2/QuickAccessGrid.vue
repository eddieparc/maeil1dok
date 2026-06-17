<template>
  <section class="quick-access">
    <h3 class="section-title">Explore</h3>

    <div class="grid-2">
      <NuxtLink to="/hasena" class="sub-card" data-testid="card-hasena">
        <ListIcon size="24" />
        <strong>하세나하시조</strong>
      </NuxtLink>

      <div class="sub-card plan-card">
        <NuxtLink to="/plan" class="card-main">
          <CalendarIcon size="24" />
          <strong>통독표</strong>
        </NuxtLink>
        <NuxtLink to="/plans" class="plan-pill" data-testid="pill-plans">
          <SettingsIcon :size="14" aria-hidden="true" />
          플랜 관리
        </NuxtLink>
      </div>

      <NuxtLink to="/scoreboard" class="sub-card" data-testid="card-scoreboard">
        <TrophyIcon :size="24" />
        <strong>리더보드</strong>
      </NuxtLink>

      <NuxtLink to="/friends" class="sub-card" data-testid="card-friends">
        <UsersIcon :size="24" />
        <strong>친구</strong>
      </NuxtLink>

      <NuxtLink to="/intro" class="sub-card">
        <MonitorIcon size="24" />
        <strong>개론 영상</strong>
      </NuxtLink>

      <NuxtLink to="/groups" class="sub-card">
        <UsersIcon :size="24" />
        <strong>커뮤니티</strong>
      </NuxtLink>

      <NuxtLink :to="profileLink" class="sub-card">
        <HistoryIcon size="24" />
        <strong>내 활동</strong>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { SettingsIcon, TrophyIcon, UsersIcon } from '@lucide/vue';
import { useLandingAuthState } from '~/composables/useLandingAuthState';
import CalendarIcon from '~/components/icons/CalendarIcon.vue';
import HistoryIcon from '~/components/icons/HistoryIcon.vue';
import ListIcon from '~/components/icons/ListIcon.vue';
import MonitorIcon from '~/components/icons/MonitorIcon.vue';

const { displayUser, isFirstPaintPending } = useLandingAuthState();

const profileLink = computed(() => {
  if (isFirstPaintPending.value) return '/login';
  return displayUser.value ? `/profile/${displayUser.value.id}` : '/login';
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
  align-items: center;
  background: var(--card-bg);
  border: 1px solid rgba(0, 0, 0, 0.02);
  border-radius: 20px;
  box-shadow: var(--paper-shadow);
  color: var(--text-main);
  display: flex;
  gap: 0.75rem;
  min-height: 96px;
  padding: 1.4rem;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card-main {
  align-items: center;
  color: inherit;
  display: flex;
  flex: 1;
  gap: 0.75rem;
  min-width: 0;
  text-decoration: none;
}

.plan-card {
  gap: 0.75rem;
  justify-content: space-between;
}

.plan-pill {
  align-items: center;
  background: var(--accent-light);
  border-radius: 999px;
  color: var(--accent);
  display: inline-flex;
  font-size: 0.75rem;
  font-weight: 700;
  gap: 0.25rem;
  line-height: 1;
  padding: 0.45rem 0.7rem;
  flex-shrink: 0;
  text-decoration: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.plan-pill:hover {
  opacity: 0.78;
  transform: translateY(-1px);
}

.sub-card:hover {
  box-shadow: 0 8px 20px rgba(44, 51, 51, 0.06);
  transform: translateY(-2px);
}

.sub-card svg,
.card-main svg {
  color: var(--text-main);
  flex-shrink: 0;
}

.plan-pill svg {
  color: currentColor;
}

.sub-card strong,
.card-main strong {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  min-width: 0;
}

@media (max-width: 480px) {
  .sub-card {
    min-height: 88px;
    padding: 1.15rem;
  }

  .plan-card {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
