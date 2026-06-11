<template>
  <TransitionGroup name="toast" tag="div" class="toast-container">
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="toast"
      :class="msg.type"
    >
      <div class="toast-content">
        <CircleCheckIcon v-if="msg.type === 'success'" :size="16" />
        <CircleXIcon v-else-if="msg.type === 'error'" :size="16" />
        <TriangleAlertIcon v-else-if="msg.type === 'warning'" :size="16" />
        <InfoIcon v-else-if="msg.type === 'info'" :size="16" />
        <span class="toast-message">{{ msg.message }}</span>
      </div>
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon } from '@lucide/vue'
import { ref } from 'vue'

interface ToastMessage {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

const messages = ref<ToastMessage[]>([])

const show = (message: string, type: ToastMessage['type'] = 'success') => {
  const id = Date.now()
  messages.value.push({ id, message, type })
  setTimeout(() => {
    messages.value = messages.value.filter(m => m.id !== id)
  }, 3000)
}

defineExpose({ show })
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  width: 100%;
  max-width: 90vw;
  padding: 0 20px;
}

.toast {
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  background: #1E293B;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  pointer-events: auto;
  min-width: min(200px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  margin: 0 auto;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toast-content svg {
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
}

.toast.success {
  background: #065F46;
}

.toast.error {
  background: #DC2626;
}

.toast.info {
  background: #2563EB;
}

.toast.warning {
  background: #D97706;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
