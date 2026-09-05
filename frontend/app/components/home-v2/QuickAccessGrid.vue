<template>
  <section class="quick-access" aria-labelledby="quick-access-title">
    <h2 id="quick-access-title" class="section-title">바로가기</h2>
    <div class="grid-2">
      <div v-if="!isKnownAuthenticated" class="sub-card plan-card">
        <NuxtLink to="/plan" class="card-main">
          <HomeShortcutIcon name="plan" />
          <strong>통독표</strong>
        </NuxtLink>
        <NuxtLink to="/plans" class="plan-pill" data-testid="pill-plans">
          <SettingsIcon :size="14" aria-hidden="true" />
          플랜 관리
        </NuxtLink>
      </div>
      <NuxtLink v-else to="/plan" class="sub-card">
        <HomeShortcutIcon name="plan" />
        <strong>통독표</strong>
      </NuxtLink>
      <NuxtLink to="/hasena" class="sub-card" data-testid="card-hasena">
        <HomeShortcutIcon name="hasena" />
        <strong>하세나하시조</strong>
      </NuxtLink>
      <NuxtLink to="/intro" class="sub-card">
        <HomeShortcutIcon name="intro" />
        <strong>개론 영상</strong>
      </NuxtLink>
      <NuxtLink to="/groups" class="sub-card">
        <HomeShortcutIcon name="groups" />
        <strong>함께</strong>
      </NuxtLink>
      <template v-if="!isKnownAuthenticated">
        <NuxtLink to="/scoreboard" class="sub-card" data-testid="card-scoreboard">
          <TrophyIcon :size="18" aria-hidden="true" />
          <strong>리더보드</strong>
        </NuxtLink>
        <NuxtLink to="/friends" class="sub-card" data-testid="card-friends">
          <UsersIcon :size="18" aria-hidden="true" />
          <strong>친구</strong>
        </NuxtLink>
        <NuxtLink :to="profileLink" class="sub-card">
          <HomeShortcutIcon name="history" />
          <strong>내 활동</strong>
        </NuxtLink>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { SettingsIcon, TrophyIcon, UsersIcon } from '@lucide/vue';
import { useLandingAuthState } from '~/composables/useLandingAuthState';
import HomeShortcutIcon from '~/components/home-v2/HomeShortcutIcon.vue';

const { displayUser, isFirstPaintPending, isKnownAuthenticated: knownAuthenticated } = useLandingAuthState();
const isKnownAuthenticated = computed(() => knownAuthenticated.value);
const profileLink = computed(() => {
  if (isFirstPaintPending.value) return '/login';
  return displayUser.value ? `/profile/${displayUser.value.id}` : '/login';
});
</script>

<style scoped>
.section-title { margin: 0 0 10px; color: var(--color-text-secondary); font-size: 13px; font-weight: 600; line-height: 1.4; }
.grid-2 { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sub-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 14px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-card);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-card);
  text-decoration: none;
  transition: transform var(--duration-micro) ease, box-shadow var(--duration-micro) ease;
}
.sub-card svg { flex-shrink: 0; color: var(--color-text-secondary); }
.sub-card strong { font-size: 14px; font-weight: 600; line-height: 1.5; }
.sub-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }
.sub-card:active, .plan-pill:active { transform: scale(.97); }
.sub-card:focus-visible, .card-main:focus-visible, .plan-pill:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  border-color: var(--color-accent-primary);
}
.plan-card { flex-wrap: wrap; gap: 0 8px; }
.card-main { display: flex; align-items: center; gap: 10px; min-height: var(--hit-min); color: inherit; text-decoration: none; }
.plan-pill { display: inline-flex; align-items: center; gap: 4px; min-height: var(--hit-min); padding: 0 10px; border-radius: var(--radius-pill); background: var(--color-accent-primary-light); color: var(--color-accent-primary); font-size: 12px; font-weight: 600; text-decoration: none; transition: background var(--duration-micro) ease, transform var(--duration-micro) ease; }
.plan-pill:hover { background: var(--color-bg-hover); }
@media (prefers-reduced-motion: reduce) {
  .sub-card, .plan-pill { transition: none; }
  .sub-card:hover, .sub-card:active, .plan-pill:active { transform: none; }
}
</style>
