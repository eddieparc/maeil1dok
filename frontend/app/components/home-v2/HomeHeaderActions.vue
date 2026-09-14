<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { BellIcon, MenuIcon, MoonIcon, SunIcon } from '@lucide/vue';
import { useLandingAuthState } from '~/composables/useLandingAuthState';
import { useNotificationsStore } from '~/stores/notifications';

defineProps<{ isDark: boolean }>();
defineEmits<{ toggleTheme: []; openMenu: [] }>();
const { auth, displayUser, isKnownAuthenticated } = useLandingAuthState();
const notifications = useNotificationsStore();
const initial = computed(() => (displayUser.value?.nickname || displayUser.value?.username || '나').slice(0, 1));
onMounted(() => {
  watch(() => auth.isAuthenticated.value ? auth.user.value?.id : null, userId => {
    if (userId) notifications.fetchInbox();
  }, { immediate: true });
});
</script>

<template>
  <div class="header-actions">
    <template v-if="isKnownAuthenticated">
      <NuxtLink to="/notifications" class="icon-button press" :aria-label="notifications.unreadCount ? `알림, 읽지 않은 알림 ${notifications.unreadCount}개` : '알림'">
        <BellIcon :size="20" aria-hidden="true" />
        <span v-if="notifications.unreadCount" class="notification-dot" aria-hidden="true"></span>
      </NuxtLink>
      <NuxtLink :to="displayUser ? `/profile/${displayUser.id}` : '/login'" class="avatar-button press" aria-label="내 정보">
        <span class="avatar" aria-hidden="true">{{ initial }}</span>
      </NuxtLink>
    </template>
    <template v-else>
      <button class="icon-button press" :aria-label="isDark ? '라이트 모드로 전환' : '다크 모드로 전환'" @click="$emit('toggleTheme')">
        <SunIcon v-if="isDark" :size="20" aria-hidden="true" />
        <MoonIcon v-else :size="20" aria-hidden="true" />
      </button>
      <button class="icon-button press" aria-label="메뉴 열기" @click="$emit('openMenu')">
        <MenuIcon :size="22" aria-hidden="true" />
      </button>
    </template>
  </div>
</template>

<style scoped>
.header-actions { display: flex; align-items: center; gap: 4px; }
.icon-button, .avatar-button { position: relative; display: flex; align-items: center; justify-content: center; width: var(--hit-min); height: var(--hit-min); border: 1px solid transparent; border-radius: 50%; background: transparent; color: var(--color-text-primary); text-decoration: none; transition: background var(--duration-micro) ease, transform var(--duration-micro) ease; }
.icon-button:hover, .avatar-button:hover { background: var(--color-bg-hover); }
.icon-button:focus-visible, .avatar-button:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.notification-dot { position: absolute; top: 8px; right: 9px; width: 7px; height: 7px; box-sizing: content-box; border: 1.5px solid var(--color-bg-primary); border-radius: 50%; background: var(--color-accent-primary); }
.avatar { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: var(--color-accent-primary); color: var(--color-text-inverse); font-size: 13px; font-weight: 700; }
@media (prefers-reduced-motion: reduce) {
  .icon-button, .avatar-button { transition: none; }
}
</style>
