<template>
  <aside class="sidebar-nav">
    <NuxtLink to="/" class="sidebar-brand" aria-label="매일일독 홈">
      <img src="/images/logo-transparent.png" alt="매일일독" width="376" height="99" />
    </NuxtLink>
    <nav class="sidebar-menu" aria-label="주요 메뉴">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="sidebar-item"
        :class="{ active: isActive(item.to) }"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <component :is="item.icon" :size="22" :stroke-width="isActive(item.to) ? 2.2 : 2" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>
    <div class="sidebar-footer">
      <NuxtLink
        to="/notifications"
        class="sidebar-item"
        :class="{ active: isActive('/notifications') }"
        :aria-current="isActive('/notifications') ? 'page' : undefined"
        :aria-label="unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : '알림'"
      >
        <BellIcon :size="22" aria-hidden="true" />
        <span>알림</span>
        <span v-if="unreadCount > 0" class="notification-count" aria-hidden="true">{{ unreadCount }}</span>
      </NuxtLink>
      <NuxtLink :to="profileLink" class="sidebar-profile" :aria-current="isActive(profileLink) ? 'page' : undefined">
        <span class="profile-avatar" aria-hidden="true">
          <img v-if="user?.profile_image" :src="user.profile_image" alt="" width="32" height="32" />
          <UserIcon v-else :size="20" />
        </span>
        <span class="profile-copy">
          <span class="profile-name">{{ user?.nickname || user?.username || '로그인' }}</span>
          <span class="profile-caption">내 정보 · 설정</span>
        </span>
      </NuxtLink>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { BellIcon, BookOpenIcon, CalendarIcon, HouseIcon, MonitorIcon, PlayIcon, UserIcon, UsersIcon } from '@lucide/vue'
import { useAuthService } from '~/composables/useAuthService'
import { useNotificationsStore } from '~/stores/notifications'

const route = useRoute()
const { user } = useAuthService()
const notificationsStore = useNotificationsStore()
const unreadCount = computed(() => user.value ? notificationsStore.unreadCount : 0)
const profileLink = computed(() => user.value ? `/profile/${user.value.id}` : '/login')
const items = [
  { label: '홈', to: '/', icon: HouseIcon },
  { label: '성경', to: '/bible', icon: BookOpenIcon },
  { label: '통독표', to: '/plan', icon: CalendarIcon },
  { label: '하세나하시조', to: '/hasena', icon: PlayIcon },
  { label: '함께', to: '/groups', icon: UsersIcon },
  { label: '개론 영상', to: '/intro', icon: MonitorIcon },
]
const isActive = (path) => route.path === path || (path !== '/' && route.path.startsWith(`${path}/`))
</script>

<style scoped>
.sidebar-nav {
  display: none;
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 100;
  box-sizing: border-box;
  width: var(--sidebar-width);
  padding: 24px 16px;
  background: var(--color-bg-card);
  border-right: 1px solid var(--color-border-default);
  overflow-y: auto;
  letter-spacing: var(--tracking-body);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  min-height: var(--hit-min);
  padding: 0 16px;
  margin-bottom: 28px;
  border-radius: var(--radius-pill);
}

.sidebar-brand img {
  width: auto;
  height: 22px;
}

[data-theme="dark"] .sidebar-brand img {
  filter: brightness(0) invert(1);
}

.sidebar-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-item,
.sidebar-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  min-height: var(--hit-min);
  padding: 0 16px;
  border-radius: var(--radius-pill);
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color var(--duration-micro) ease, background-color var(--duration-micro) ease, transform var(--duration-micro) ease;
}

.sidebar-item {
  height: var(--hit-min);
  flex-shrink: 0;
}

.sidebar-item svg {
  flex-shrink: 0;
}

.sidebar-item:hover,
.sidebar-profile:hover {
  background: var(--color-bg-hover);
}

.sidebar-item.active {
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
  font-weight: 600;
}

.sidebar-item:active,
.sidebar-profile:active,
.sidebar-brand:active {
  transform: scale(.97);
}

.sidebar-item:focus-visible,
.sidebar-profile:focus-visible,
.sidebar-brand:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px var(--color-accent-primary);
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: auto;
  padding-top: 24px;
}

.notification-count {
  margin-left: auto;
  min-width: 20px;
  padding: 3px 6px;
  border-radius: var(--radius-pill);
  background: var(--color-accent-primary-light);
  color: var(--color-accent-primary);
  font-size: 11px;
  line-height: 1.2;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.sidebar-profile {
  padding: 8px 12px;
}

.profile-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 32px;
  height: 32px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
}

.profile-avatar img {
  width: 32px;
  height: 32px;
  object-fit: cover;
}

.profile-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.profile-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-primary);
  font-weight: 600;
}

.profile-caption {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

@media (min-width: 1024px) {
  .sidebar-nav {
    display: flex;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-item,
  .sidebar-profile {
    transition: none;
  }

  .sidebar-item:active,
  .sidebar-profile:active,
  .sidebar-brand:active {
    transform: none;
  }
}
</style>
