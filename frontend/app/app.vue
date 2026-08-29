<template>
  <div>
    <!-- Email Verification Banner (sticky top) -->
    <ClientOnly>
      <EmailVerificationBanner />
    </ClientOnly>

    <!-- Shown when the session could not be verified (server unreachable).
         Client-only: the state is decided by a client-side refresh attempt. -->
    <ClientOnly>
      <SessionUnknownBanner />
    </ClientOnly>

    <!-- Old store binaries can never receive an OTA (they send no update channel),
         so the web app is the only place that can tell them to update. -->
    <ClientOnly>
      <LegacyShellUpdateBanner />
    </ClientOnly>

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- Global UI Infrastructure -->
    <ClientOnly>
      <ModalHost />
      <ToastHost />
    </ClientOnly>

    <!-- Legacy Toast (마이그레이션 완료 후 제거 예정) -->
    <Toast ref="legacyToast" />
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
import Toast from '~/components/Toast.vue'
import ModalHost from '~/components/ui/modal/ModalHost.vue'
import ToastHost from '~/components/ui/toast/ToastHost.vue'
import EmailVerificationBanner from '~/components/auth/EmailVerificationBanner.vue'
import SessionUnknownBanner from '~/components/auth/SessionUnknownBanner.vue'
import LegacyShellUpdateBanner from '~/components/auth/LegacyShellUpdateBanner.vue'

// Legacy toast 인스턴스 (마이그레이션 완료 후 제거 예정)
const legacyToast = ref()
provide('toast', legacyToast)

// Auth initialization moved to plugins/auth-init.ts
</script>
