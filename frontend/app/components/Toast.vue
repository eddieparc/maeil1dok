<template>
  <TransitionGroup name="toast" tag="div" class="toast-container">
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="toast"
      :class="msg.type"
    >
      <div class="toast-content">
        <!-- Success: Checkmark -->
        <svg v-if="msg.type === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <!-- Error: X mark -->
        <svg v-else-if="msg.type === 'error'" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <!-- Warning: Exclamation triangle -->
        <svg v-else-if="msg.type === 'warning'" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <!-- Info: Info circle -->
        <svg v-else-if="msg.type === 'info'" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="toast-message">{{ msg.message }}</span>
      </div>
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
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