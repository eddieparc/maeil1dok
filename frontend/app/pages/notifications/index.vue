<template>
  <PageLayout title="알림" class="notifications-page">
    <template #header-action>
      <NuxtLink to="/notifications/settings" class="settings-link" aria-label="알림 설정">
        <SettingsIcon :size="20" aria-hidden="true" />
      </NuxtLink>
    </template>

    <div class="notifications-shell">
      <h2 class="sr-only">알림</h2>
      <div class="notifications-toolbar">
        <div class="notification-filters" role="group" aria-label="알림 필터">
          <FilterChip
            v-for="filter in filterOptions"
            :key="filter.value"
            :label="filter.label"
            :active="activeFilter === filter.value"
            @click="activeFilter = filter.value"
          />
        </div>
        <button
          v-if="notificationsStore.unreadCount > 0"
          class="mark-all-button"
          type="button"
          @click="notificationsStore.markAllAsRead"
        >
          모두 읽음
        </button>
      </div>

    <ListCard
      v-if="!notificationsStore.hasLoadedInbox || (notificationsStore.isLoading && notificationsStore.notifications.length === 0)"
      :padded="false"
      class="notification-list"
      role="status"
      aria-busy="true"
      aria-label="알림 불러오는 중"
    >
        <div v-for="row in 5" :key="row" class="notification-card" aria-hidden="true">
          <Skeleton width="34px" height="34px" circle />
          <div class="notification-copy">
            <Skeleton width="60%" height="21px" />
            <Skeleton width="90%" height="20px" />
            <Skeleton width="64px" height="15px" />
          </div>
        </div>
      </ListCard>

      <ErrorState
        v-else-if="notificationsStore.error"
        :message="notificationsStore.error"
        @retry="loadInbox"
      />

      <EmptyState
        v-else-if="visibleNotifications.length === 0"
        title="새로운 알림이 없어요"
        description="평안하고 말씀 충만한 하루 보내세요."
      >
        <template #icon><BellIcon :size="32" aria-hidden="true" /></template>
      </EmptyState>

      <div v-else class="notification-groups" aria-label="알림 목록">
        <section
          v-for="(group, index) in notificationGroups"
          :key="group.date"
          class="notification-group"
          :style="{ '--group-index': index }"
          :aria-labelledby="`notification-date-${group.date}`"
        >
          <h3 :id="`notification-date-${group.date}`" class="notification-date-label">{{ group.label }}</h3>
          <ListCard :padded="false" class="notification-list">
            <NuxtLink
              v-for="notification in group.notifications"
              :key="notification.id"
              :to="notification.target_url || '/notifications'"
              class="notification-card"
              :class="{ 'notification-card--unread': !notification.is_read }"
              :data-unread="!notification.is_read"
              :aria-label="getNotificationLabel(notification)"
              @click="notificationsStore.markAsRead(notification.id)"
            >
              <span class="notification-icon" aria-hidden="true">
                <NotificationTypeIcon :type="notification.type" />
              </span>
              <span class="notification-copy">
                <span class="notification-title">{{ notification.title }}</span>
                <span class="notification-body">{{ notification.body }}</span>
                <time class="notification-time" :datetime="notification.created_at">{{ formatDate(notification.created_at) }}</time>
              </span>
              <span v-if="!notification.is_read" class="notification-unread-dot" aria-hidden="true" />
            </NuxtLink>
          </ListCard>
        </section>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BellIcon, SettingsIcon } from '@lucide/vue'
import PageLayout from '~/components/common/PageLayout.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import FilterChip from '~/components/ui/FilterChip.vue'
import ListCard from '~/components/ui/ListCard.vue'
import Skeleton from '~/components/ui/Skeleton.vue'
import NotificationTypeIcon from '~/components/notifications/NotificationTypeIcon.vue'
import { useNotificationsStore, type NotificationItem } from '~/stores/notifications'

useHead({
  title: '알림 · 매일일독',
  meta: [
    { name: 'description', content: '통독, 하세나하시조, 친구 활동 알림을 확인합니다.' },
  ],
})

const notificationsStore = useNotificationsStore()
const activeFilter = ref<'all' | 'unread'>('all')

const filterOptions = [
  { value: 'all', label: '전체' },
  { value: 'unread', label: '읽지 않음' },
] as const

const visibleNotifications = computed(() => {
  if (activeFilter.value === 'unread') {
    return notificationsStore.unreadNotifications
  }
  return notificationsStore.notifications
})

const notificationGroups = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const groups = new Map<number, { date: number; label: string; notifications: NotificationItem[] }>()

  for (const notification of visibleNotifications.value) {
    const date = new Date(notification.created_at)
    date.setHours(0, 0, 0, 0)
    const key = date.getTime()
    let group = groups.get(key)
    if (!group) {
      const label = key === today.getTime()
        ? '오늘'
        : key === yesterday.getTime() ? '어제' : dateFormatter.format(date)
      group = { date: key, label, notifications: [] }
      groups.set(key, group)
    }
    group.notifications.push(notification)
  }

  return [...groups.values()].sort((a, b) => b.date - a.date)
})

const loadInbox = async () => {
  await notificationsStore.fetchInbox(activeFilter.value === 'unread')
}

const formatDate = (value: string) => {
  const date = new Date(value)
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const getNotificationLabel = (notification: NotificationItem) => {
  const readState = notification.is_read ? '읽음' : '읽지 않음'
  return `${readState}: ${notification.title}. ${notification.body}`
}

watch(activeFilter, () => {
  loadInbox()
})

onMounted(() => {
  loadInbox()
})
</script>

<style scoped>
.notifications-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 14px var(--screen-gutter) var(--screen-gutter);
  letter-spacing: var(--tracking-body);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.notifications-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
}

.notification-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mark-all-button {
  flex-shrink: 0;
  min-height: var(--hit-min);
  min-width: var(--hit-min);
  padding: 0 4px;
  border-radius: var(--radius-pill);
  border: 0;
  background: none;
  color: var(--color-accent-primary);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: inherit;
  cursor: pointer;
  transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease;
}

.notification-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.notification-group {
  animation: notification-enter var(--duration-enter) var(--ease-out-quint) both;
  animation-delay: calc(80ms + var(--group-index) * var(--stagger));
}

.notification-date-label {
  margin: 0 0 8px;
  color: var(--color-text-tertiary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.notification-list {
  overflow: hidden;
}

.notification-card {
  display: flex;
  box-sizing: border-box;
  min-height: 56px;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  color: var(--color-text-primary);
  text-decoration: none;
  border-bottom: 1px solid var(--color-border-light);
  transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease;
}

.notification-card:last-child {
  border-bottom: 0;
}

.notification-card:hover,
.mark-all-button:hover,
.settings-link:hover {
  background: var(--color-bg-hover);
}

.notification-card:active,
.mark-all-button:active,
.settings-link:active {
  transform: scale(0.97);
}

.notification-card:focus-visible,
.mark-all-button:focus-visible,
.settings-link:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: -3px;
  box-shadow: inset 0 0 0 1px var(--color-accent-primary);
}

.notification-icon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.notification-card--unread .notification-icon {
  background: var(--color-accent-primary-light);
  color: var(--color-accent-primary);
}

.notification-card--unread .notification-title {
  font-weight: 700;
}

.notification-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.notification-title {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.5;
}

.notification-body {
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.notification-time {
  color: var(--color-text-tertiary);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
}

.notification-unread-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--color-accent-primary);
}

.settings-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--hit-min);
  height: var(--hit-min);
  border-radius: 50%;
  color: var(--color-text-secondary);
  transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease;
}

.notifications-page :deep(.header) {
  box-sizing: border-box;
  height: var(--appbar-height);
  padding: 4px 12px;
  gap: 0;
}

.notifications-page :deep(.header h1) {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: var(--tracking-body);
  text-align: center;
}

.notifications-page :deep(.back-button) {
  width: var(--hit-min);
  height: var(--hit-min);
  border-radius: 50%;
}

.notifications-page :deep(.back-button svg) {
  width: 22px;
  height: 22px;
}

.notifications-page :deep(.back-button:focus-visible) {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: -3px;
  box-shadow: inset 0 0 0 1px var(--color-accent-primary);
}

@keyframes notification-enter {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .notification-group { animation-name: notification-fade; animation-delay: 0ms; }
  .notification-card,
  .mark-all-button,
  .settings-link,
  .notifications-page :deep(.back-button) { transition: none; }
  .notification-card:active,
  .mark-all-button:active,
  .settings-link:active { transform: none; }
}

@keyframes notification-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
