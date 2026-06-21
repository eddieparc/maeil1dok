<template>
  <PageLayout title="알림">
    <div class="notifications-shell">
      <h2 class="sr-only">알림</h2>
      <div class="notifications-toolbar">
        <FilterButtonGroup
          v-model="activeFilter"
          :options="filterOptions"
          label="알림 필터"
        />
        <button
          v-if="notificationsStore.unreadCount > 0"
          class="mark-all-button"
          type="button"
          @click="notificationsStore.markAllAsRead"
        >
          모두 읽음
        </button>
      </div>

      <div v-if="notificationsStore.isLoading" class="notification-list">
        <SkeletonList :count="5" variant="default" />
      </div>

      <ErrorState
        v-else-if="notificationsStore.error"
        :message="notificationsStore.error"
        @retry="loadInbox"
      />

      <EmptyState
        v-else-if="visibleNotifications.length === 0"
        title="새로운 알림이 없어요"
        description="평안하고 말씀 충만한 하루 보내세요."
      />

      <div v-else class="notification-list" aria-label="알림 목록">
        <NuxtLink
          v-for="notification in visibleNotifications"
          :key="notification.id"
          :to="notification.target_url || '/notifications'"
          class="notification-card"
          :data-unread="!notification.is_read"
          :aria-label="getNotificationLabel(notification)"
          @click="notificationsStore.markAsRead(notification.id)"
        >
          <span class="notification-icon" aria-hidden="true">
            <component :is="getIcon(notification.type)" :size="18" />
          </span>
          <span class="notification-copy">
            <span class="notification-title">{{ notification.title }}</span>
            <span class="notification-body">{{ notification.body }}</span>
            <span class="notification-time">{{ formatDate(notification.created_at) }}</span>
          </span>
          <span v-if="!notification.is_read" class="notification-unread-dot" aria-hidden="true" />
        </NuxtLink>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  BellIcon,
  BookOpenIcon,
  CheckCircleIcon,
  UsersIcon,
} from '@lucide/vue'
import PageLayout from '~/components/common/PageLayout.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import FilterButtonGroup from '~/components/common/FilterButtonGroup.vue'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'
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
]

const visibleNotifications = computed(() => {
  if (activeFilter.value === 'unread') {
    return notificationsStore.unreadNotifications
  }
  return notificationsStore.notifications
})

const loadInbox = async () => {
  await notificationsStore.fetchInbox(activeFilter.value === 'unread')
}

const getIcon = (type: NotificationItem['type']) => {
  switch (type) {
    case 'reading_reminder':
      return BookOpenIcon
    case 'hasena_reminder':
      return CheckCircleIcon
    case 'friend_activity':
      return UsersIcon
    case 'system':
      return BellIcon
    default:
      return BellIcon
  }
}

const formatDate = (value: string) => {
  const date = new Date(value)
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
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
  gap: var(--spacing-4);
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: var(--spacing-4);
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

.mark-all-button {
  min-height: 40px;
  padding: 0 var(--spacing-3);
  border-radius: 8px;
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-card);
  color: var(--color-accent-primary);
  font-size: 0.875rem;
  font-weight: 600;
}

.notification-list {
  overflow: hidden;
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  background: var(--color-bg-card);
}

.notification-card {
  display: flex;
  min-height: 68px;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  color: var(--color-text-primary);
  text-decoration: none;
  border-bottom: 1px solid var(--color-border-light);
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.notification-card:last-child {
  border-bottom: 0;
}

.notification-card[data-unread="true"] {
  background: var(--color-bg-tertiary);
}

.notification-card:active {
  transform: translateY(1px);
}

.notification-icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--color-bg-tertiary);
  color: var(--color-accent-primary);
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
  font-size: 0.875rem;
  line-height: 1.5;
}

.notification-time {
  color: var(--color-text-tertiary);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.4;
}

.notification-unread-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--color-accent-primary);
}
</style>
