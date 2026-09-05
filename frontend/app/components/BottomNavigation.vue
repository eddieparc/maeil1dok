<template>
  <div class="bottom-nav-container">
    <nav class="bottom-nav" aria-label="주요 메뉴">
      <NuxtLink to="/" class="nav-item" :class="{ active: isActive('/') }" :aria-current="isActive('/') ? 'page' : undefined">
        <HouseIcon :size="22" :stroke-width="isActive('/') ? 2.2 : 2" aria-hidden="true" />
        <span>홈</span>
      </NuxtLink>
      <NuxtLink to="/bible" class="nav-item" :class="{ active: isActive('/bible') }" :aria-current="isActive('/bible') ? 'page' : undefined">
        <BookOpenIcon :size="22" :stroke-width="isActive('/bible') ? 2.2 : 2" aria-hidden="true" />
        <span>성경</span>
      </NuxtLink>
      <NuxtLink to="/plan" class="nav-item" :class="{ active: isActive('/plan') }" :aria-current="isActive('/plan') ? 'page' : undefined">
        <CalendarIcon :size="22" :stroke-width="isActive('/plan') ? 2.2 : 2" aria-hidden="true" />
        <span>통독표</span>
      </NuxtLink>
      <NuxtLink to="/groups" class="nav-item" :class="{ active: isActive('/groups') }" :aria-current="isActive('/groups') ? 'page' : undefined">
        <UsersIcon :size="22" :stroke-width="isActive('/groups') ? 2.2 : 2" aria-hidden="true" />
        <span>함께</span>
      </NuxtLink>
      <NuxtLink :to="profileLink" class="nav-item" :class="{ active: isActive(profileLink) }" :aria-current="isActive(profileLink) ? 'page' : undefined">
        <UserIcon :size="22" :stroke-width="isActive(profileLink) ? 2.2 : 2" aria-hidden="true" />
        <span>내 정보</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BookOpenIcon, CalendarIcon, HouseIcon, UserIcon, UsersIcon } from '@lucide/vue'
import { useAuthService } from '~/composables/useAuthService'

const route = useRoute()
const { user } = useAuthService()
const profileLink = computed(() => user.value ? `/profile/${user.value.id}` : '/login')

const isActive = (path) => route.path === path || (path !== '/' && route.path.startsWith(`${path}/`))
</script>

<style scoped>
.bottom-nav-container {
  position: fixed;
  inset: auto 0 0;
  z-index: 100;
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-border-default);
  padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--native-bottom-inset, 0px));
}

.bottom-nav {
  display: flex;
  align-items: flex-start;
  box-sizing: border-box;
  height: var(--tabbar-height);
  max-width: 768px;
  margin: 0 auto;
  padding: 6px 8px 24px;
}

.nav-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  height: 100%;
  color: var(--color-text-tertiary);
  border-radius: var(--radius-control);
  text-decoration: none;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: var(--tracking-body);
  transition: color var(--duration-micro) ease, background-color var(--duration-micro) ease, transform var(--duration-micro) ease;
}

.nav-item:hover {
  background: var(--color-bg-hover);
}

.nav-item.active {
  color: var(--color-accent-primary);
  font-weight: 600;
}

.nav-item:active {
  transform: scale(.97);
}

.nav-item:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px var(--color-accent-primary);
}

@media (min-width: 1024px) {
  .bottom-nav-container {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-item {
    transition: none;
  }

  .nav-item:active {
    transform: none;
  }
}
</style>
