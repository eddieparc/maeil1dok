<template>
  <PageLayout title="알림 설정">
    <div class="notification-settings-shell">
      <h2 class="sr-only">알림 설정</h2>
      <div v-if="notificationsStore.isLoading && !settings" class="settings-card">
        <SkeletonList :count="4" variant="default" />
      </div>

      <ErrorState
        v-else-if="notificationsStore.error && !settings"
        :message="notificationsStore.error"
        @retry="notificationsStore.fetchSettings"
      />

      <form v-else-if="settings" class="settings-card" @submit.prevent="saveSettings">
        <DevicePushSetting />

        <label class="setting-row">
          <span>
            <strong>전체 알림</strong>
            <small>통독과 친구 활동 알림을 한 번에 관리합니다.</small>
          </span>
          <input
            v-model="settings.notifications_enabled"
            type="checkbox"
            role="switch"
          >
        </label>

        <label class="setting-row">
          <span>
            <strong>통독 응원</strong>
            <small>오늘 배정된 통독을 놓치지 않도록 알려드려요.</small>
          </span>
          <input
            v-model="settings.reading_reminders_enabled"
            type="checkbox"
            role="switch"
            :disabled="!settings.notifications_enabled"
          >
        </label>

        <label class="setting-row compact">
          <span>
            <strong>통독 알림 시간</strong>
          </span>
          <input
            v-model="settings.reading_reminder_time"
            type="time"
            :disabled="!settings.notifications_enabled || !settings.reading_reminders_enabled"
          >
        </label>

        <label class="setting-row">
          <span>
            <strong>하세나하시조 알림</strong>
            <small>오늘의 묵상 시간을 부드럽게 알려드려요.</small>
          </span>
          <input
            v-model="settings.hasena_reminders_enabled"
            type="checkbox"
            role="switch"
            :disabled="!settings.notifications_enabled"
          >
        </label>

        <label class="setting-row compact">
          <span>
            <strong>하세나하시조 알림 시간</strong>
          </span>
          <input
            v-model="settings.hasena_reminder_time"
            type="time"
            :disabled="!settings.notifications_enabled || !settings.hasena_reminders_enabled"
          >
        </label>

        <label class="setting-row">
          <span>
            <strong>친구 활동</strong>
            <small>서로 팔로우한 친구의 통독과 하세나 활동을 받아봅니다.</small>
          </span>
          <input
            v-model="settings.friend_activity_enabled"
            type="checkbox"
            role="switch"
            :disabled="!settings.notifications_enabled"
          >
        </label>

        <div class="settings-actions">
          <NuxtLink to="/notifications" class="history-link">알림 내역 보기</NuxtLink>
          <button class="save-button" type="submit" :disabled="notificationsStore.isSaving">
            {{ notificationsStore.isSaving ? '저장 중' : '저장' }}
          </button>
        </div>
      </form>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import PageLayout from '~/components/common/PageLayout.vue'
import ErrorState from '~/components/ErrorState.vue'
import DevicePushSetting from '~/components/notifications/DevicePushSetting.vue'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'
import { useNotificationsStore, type NotificationSettings } from '~/stores/notifications'
import { useToast } from '~/composables/useToast'

useHead({
  title: '알림 설정 · 매일일독',
  meta: [
    { name: 'description', content: '통독, 하세나하시조, 친구 활동 알림 설정을 관리합니다.' },
  ],
})

const notificationsStore = useNotificationsStore()
const toast = useToast()
const settings = ref<NotificationSettings | null>(null)

watch(
  () => notificationsStore.settings,
  (value) => {
    settings.value = value ? { ...value } : null
  },
  { immediate: true },
)

const saveSettings = async () => {
  if (!settings.value) return

  const result = await notificationsStore.updateSettings(settings.value)
  if (result.success) {
    toast.success('알림 설정을 저장했습니다.')
  } else {
    toast.error(result.error)
  }
}

onMounted(() => {
  notificationsStore.fetchSettings()
  notificationsStore.syncDevicePushState()
})
</script>

<style scoped>
.notification-settings-shell {
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

.settings-card {
  overflow: hidden;
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  background: var(--color-bg-card);
}

.setting-row {
  display: flex;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  border-bottom: 1px solid var(--color-border-light);
  word-break: keep-all;
  overflow-wrap: break-word;
}

.setting-row.compact {
  min-height: 56px;
}

.setting-row span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--spacing-1);
}

.setting-row strong {
  color: var(--color-text-primary);
  font-size: 0.9375rem;
  font-weight: 600;
}

.setting-row small {
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.setting-row input[type="checkbox"] {
  width: 44px;
  height: 24px;
  accent-color: var(--color-accent-primary);
}

.setting-row input[type="time"] {
  min-height: 40px;
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  padding: 0 var(--spacing-3);
}

.settings-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.history-link {
  color: var(--color-accent-primary);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
}

.save-button {
  min-height: 44px;
  min-width: 88px;
  border-radius: 8px;
  border: 0;
  background: var(--color-accent-primary);
  color: white;
  font-weight: 700;
}

.save-button:disabled {
  opacity: 0.6;
}
</style>
