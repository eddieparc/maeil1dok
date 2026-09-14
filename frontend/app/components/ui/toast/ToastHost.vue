<template>
  <Teleport to="body">
    <div class="toast-host" :style="{ '--toast-bottom-inset': bottomInset }" role="region" aria-label="알림">
      <!-- No leaving toast is retained alongside its replacement. -->
      <div class="toast-container">
        <ToastItem
          v-for="toast in toasts"
          :key="toast.id"
          :toast="toast"
          @dismiss="handleDismiss"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useToastState } from '~/composables/useToastState'
import ToastItem from './ToastItem.vue'

const state = useToastState()
const toasts = state.toasts
const bottomInset = ref<string>()
let navigation: Element | null = null
let resizeObserver: ResizeObserver | undefined
let mutationObserver: MutationObserver | undefined

function updateBottomInset(): void {
  const bounds = navigation?.getBoundingClientRect()
  // The real stack includes its safe inset and any legacy reader controls.
  bottomInset.value = bounds && bounds.height > 0
    ? `${Math.max(0, window.innerHeight - bounds.top)}px`
    : undefined
}

function syncNavigation(): void {
  const current = document.querySelector('.bottom-nav-container')
  if (current === navigation) return
  resizeObserver?.disconnect()
  navigation = current
  if (navigation) resizeObserver?.observe(navigation)
  updateBottomInset()
}

onMounted(() => {
  resizeObserver = new ResizeObserver(updateBottomInset)
  mutationObserver = new MutationObserver(syncNavigation)
  mutationObserver.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', updateBottomInset)
  syncNavigation()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  window.removeEventListener('resize', updateBottomInset)
})

function handleDismiss(id: string) {
  state.dismiss(id)
}
</script>

<style>
.toast-host {
  --toast-min-width: 200px;
  --toast-max-width: 400px;
  --toast-radius: var(--radius-pill);
  --toast-navigation-offset: 0px;
  --toast-safe-offset: max(env(safe-area-inset-bottom, 0px), var(--native-bottom-inset, 0px));
  --toast-audio-offset: 0px;
  --toast-progress-offset: 0px;
  --toast-bottom-inset: calc(var(--toast-navigation-offset) + var(--toast-safe-offset) + var(--toast-audio-offset) + var(--toast-progress-offset));
  position: fixed;
  bottom: calc(16px + var(--toast-bottom-inset));
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  pointer-events: none;
  box-sizing: border-box;
  width: min(100%, 432px);
  padding: 0 16px;
}

.toast-container {
  display: flex;
  justify-content: center;
}

/* Independent reader rows remain above the tabs, even when tabs are hidden. */
body:has(.tongdok-audio-player) .toast-host {
  --toast-audio-offset: 44px;
}

body:has(.tongdok-progress-area) .toast-host {
  --toast-progress-offset: 44px;
}

@media (max-width: 1023px) {
  body:has(.bottom-nav-container) .toast-host {
    --toast-navigation-offset: var(--mobile-nav-height, calc(var(--tabbar-height) - 24px + max(24px, env(safe-area-inset-bottom, 0px), var(--native-bottom-inset, 0px))));
    /* Navigation height already includes the device/design safe inset. */
    --toast-safe-offset: 0px;
  }
}
</style>
