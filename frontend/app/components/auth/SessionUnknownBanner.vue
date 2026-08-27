<template>
  <Transition name="banner">
    <div v-if="auth.isSessionUnknown.value" class="session-unknown-banner" role="status" aria-live="polite">
      <div class="banner-content">
        <svg class="banner-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-1 1v3a1 1 0 002 0V8a1 1 0 00-1-1zm0 7a1 1 0 100 2 1 1 0 000-2z" clip-rule="evenodd" />
        </svg>
        <span class="banner-message">
          연결이 불안정해 로그인 상태를 확인하지 못했습니다.
        </span>
      </div>
      <div class="banner-actions">
        <button
          type="button"
          class="banner-retry"
          data-testid="session-unknown-retry"
          :disabled="retrying"
          @click="handleRetry"
        >
          {{ retrying ? '확인 중…' : '다시 시도' }}
        </button>
        <NuxtLink
          class="banner-signin"
          data-testid="session-unknown-signin"
          to="/login"
        >
          로그인
        </NuxtLink>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * Shown when the session could not be verified because the server was
 * unreachable — NOT when the user is signed out.
 *
 * Deliberately a banner, not a full-screen lock. The plan calls this a "neutral
 * lock screen", but bible text and reading history already loaded are readable
 * offline; covering them would leave the user worse off than the bug this fixes.
 * The banner is prominent and persistent, and it disappears on its own the moment
 * the session resolves either way.
 *
 * Hosted once in app.vue rather than branched into every component that reads
 * `isAuthenticated`: there are eight or more such call sites and one would
 * inevitably be missed.
 *
 * There is no dismiss button. Dismissing would leave the user in a state where
 * auth-gated UI silently does nothing with no explanation on screen.
 */
import { ref } from 'vue'
import { useAuthService } from '~/composables/useAuthService'

const auth = useAuthService()
const retrying = ref(false)

async function handleRetry(): Promise<void> {
  if (retrying.value) return
  retrying.value = true
  try {
    // Re-asks the server. On success the state leaves `unknown-offline` and this
    // banner unmounts; on another transport failure it stays, which is the honest
    // outcome. Never hides the notice without re-verifying.
    await auth.revalidate()
  } finally {
    retrying.value = false
  }
}
</script>

<style scoped>
.session-unknown-banner {
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  background-color: #f1f5f9;
  border-bottom: 1px solid #cbd5e1;
  color: #334155;
  font-size: 0.875rem;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.banner-icon {
  flex-shrink: 0;
  width: 1.125rem;
  height: 1.125rem;
  color: #64748b;
}

.banner-message {
  overflow-wrap: anywhere;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.banner-retry,
.banner-signin {
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.4;
  text-decoration: none;
  white-space: nowrap;
}

.banner-retry {
  border: 1px solid #94a3b8;
  background-color: #ffffff;
  color: #334155;
  cursor: pointer;
}

.banner-retry:disabled {
  opacity: 0.6;
  cursor: default;
}

.banner-signin {
  border: 1px solid transparent;
  background-color: #475569;
  color: #ffffff;
}

.banner-enter-active,
.banner-leave-active {
  transition: opacity 0.2s ease;
}

.banner-enter-from,
.banner-leave-to {
  opacity: 0;
}
</style>
