<template>
  <Transition name="banner">
    <div
      v-if="advice.mode === 'blocking'"
      class="shell-update-block"
      role="alertdialog"
      aria-modal="true"
      data-testid="legacy-shell-block"
    >
      <div class="block-card">
        <h2 class="block-title">앱 업데이트가 필요합니다</h2>
        <p class="block-body">
          설치된 앱이 오래된 버전이라 로그인이 유지되지 않을 수 있습니다.<br>
          스토어에서 업데이트하면 계속 사용할 수 있습니다.
        </p>
        <a v-if="advice.storeUrl" class="block-action" :href="advice.storeUrl" rel="noopener">
          {{ storeName }}에서 업데이트
        </a>
        <p v-else class="block-body">앱 스토어에서 <strong>매일일독</strong>을 업데이트해 주세요.</p>
      </div>
    </div>

    <div
      v-else-if="advice.mode === 'notice'"
      class="shell-update-banner"
      role="status"
      aria-live="polite"
      data-testid="legacy-shell-notice"
    >
      <div class="banner-content">
        <svg class="banner-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 002 0V7zm-1 7a1 1 0 100 2 1 1 0 000-2z" clip-rule="evenodd" />
        </svg>
        <span class="banner-message">
          앱이 오래된 버전입니다. 업데이트하면 로그인이 풀리는 문제가 해결됩니다.
        </span>
      </div>
      <a
        v-if="advice.storeUrl"
        class="banner-action"
        :href="advice.storeUrl"
        rel="noopener"
        data-testid="legacy-shell-store-link"
      >
        {{ storeName }} 열기
      </a>
      <span v-else class="banner-action-plain">스토어에서 업데이트</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * Tells users on the old store binary to update from the store.
 *
 * They cannot be reached any other way. Their app sends no update channel, so
 * every OTA check is answered `HTTP 400 "channel-name": Required` — the session
 * fixes will never arrive over the air. A new store build is the only path, and
 * this web app is the only surface that can say so.
 *
 * The audience is decided by what the shell injects, never by user agent alone:
 * only the new shell sets `window.__shellBundleIdentity`, so its absence inside
 * a WebView identifies the old bundle exactly. Users already on the new shell,
 * and users in an ordinary browser, see nothing.
 *
 * Read on mount, not during SSR: the answer lives on `window`, and baking it
 * into a cached server render would show one device's verdict to everyone.
 */
import { computed, onMounted, ref } from 'vue'
import { useRuntimeConfig } from 'nuxt/app'
import { classifyShellIdentity } from '~/composables/shellBundleIdentity'
import { adviseShellUpdate, type ShellUpdateAdvice } from '~/composables/shellUpdateAdvice'

const config = useRuntimeConfig()

const advice = ref<ShellUpdateAdvice>({ mode: 'hidden', platform: 'unknown', storeUrl: null })

const storeName = computed(() => (advice.value.platform === 'ios' ? 'App Store' : 'Play 스토어'))

onMounted(() => {
  const shell = window as unknown as {
    isReactNativeWebView?: unknown
    isAndroidApp?: unknown
    __shellBundleIdentity?: unknown
  }
  const identity = classifyShellIdentity({
    isNativeApp: shell.isReactNativeWebView === true,
    reported: shell.__shellBundleIdentity,
  })
  advice.value = adviseShellUpdate({
    identityState: identity.state,
    isAndroidHint: shell.isAndroidApp,
    userAgent: navigator.userAgent,
    enforcement: config.public.legacyShellEnforcement,
  })
})
</script>

<style scoped>
.shell-update-banner {
  position: sticky;
  top: 0;
  z-index: 61;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  background-color: #fef3c7;
  border-bottom: 1px solid #fcd34d;
  color: #78350f;
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
  color: #b45309;
}

.banner-message {
  overflow-wrap: anywhere;
}

.banner-action,
.banner-action-plain {
  flex-shrink: 0;
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  text-decoration: none;
}

.banner-action {
  background-color: #b45309;
  color: #ffffff;
}

.banner-action-plain {
  color: #78350f;
}

.shell-update-block {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: rgba(15, 23, 42, 0.72);
}

.block-card {
  width: 100%;
  max-width: 22rem;
  padding: 1.5rem;
  border-radius: 1rem;
  background-color: #ffffff;
  text-align: center;
}

.block-title {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.block-body {
  margin: 0 0 1.25rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: #475569;
}

.block-action {
  display: inline-block;
  padding: 0.6rem 1.25rem;
  border-radius: 0.5rem;
  background-color: #b45309;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
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
