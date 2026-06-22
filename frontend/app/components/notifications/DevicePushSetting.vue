<template>
  <div class="setting-row">
    <span>
      <strong>현재 기기 푸시 알림</strong>
      <small :class="{ 'status-error': pushStatusTone === 'error' }">{{ devicePushLabel }}</small>
    </span>
    <button
      v-if="showDevicePushButton"
      class="push-button"
      :class="{ 'is-active': notificationsStore.devicePush.subscribed }"
      type="button"
      :disabled="notificationsStore.devicePush.isSyncing"
      @click="toggleDevicePush"
    >
      {{ devicePushButtonLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNotificationsStore } from '~/stores/notifications'
import { useToast } from '~/composables/useToast'

const notificationsStore = useNotificationsStore()
const toast = useToast()

const devicePushLabel = computed(() => {
  const state = notificationsStore.devicePush
  if (state.permission === 'unsupported') return '이 브라우저는 푸시를 지원하지 않습니다.'
  if (state.permission === 'unavailable') return '푸시 알림 서버 설정이 아직 준비되지 않았습니다.'
  if (state.permission === 'denied') return '브라우저에서 알림 권한이 차단되어 있습니다.'
  if (state.subscribed) return '이 기기에서 OS 알림을 받고 있습니다.'
  return '이 기기에서 OS 알림을 받을 수 있습니다.'
})

const pushStatusTone = computed(() => {
  const permission = notificationsStore.devicePush.permission
  return permission === 'denied' || permission === 'unsupported' || permission === 'unavailable'
    ? 'error'
    : 'default'
})

const showDevicePushButton = computed(() => {
  const permission = notificationsStore.devicePush.permission
  return notificationsStore.devicePush.supported && permission !== 'denied' && permission !== 'unavailable'
})

const devicePushButtonLabel = computed(() => {
  if (notificationsStore.devicePush.isSyncing) return '처리 중'
  return notificationsStore.devicePush.subscribed ? '끄기' : '켜기'
})

const toggleDevicePush = async () => {
  const result = notificationsStore.devicePush.subscribed
    ? await notificationsStore.disableDevicePush()
    : await notificationsStore.enableDevicePush()
  if (result.success) {
    toast.success(notificationsStore.devicePush.subscribed ? '기기 푸시 알림을 켰습니다.' : '기기 푸시 알림을 껐습니다.')
  } else {
    toast.error(result.error)
  }
}
</script>

<style scoped>
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

.push-button {
  min-height: 36px;
  min-width: 68px;
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  font-weight: 700;
}

.push-button.is-active {
  border-color: var(--color-accent-primary);
  background: var(--color-accent-primary);
  color: white;
}

.push-button:disabled {
  opacity: 0.6;
}

.status-error {
  color: var(--color-error, #b42318);
}
</style>
