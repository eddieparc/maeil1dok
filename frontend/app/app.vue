<template>
  <div>
    <BetaTestMailNotice />

    <!-- Email Verification Banner (sticky top) -->
    <ClientOnly>
      <EmailVerificationBanner />
    </ClientOnly>

    <!-- Shown when the session could not be verified (server unreachable).
         Client-only: the state is decided by a client-side refresh attempt. -->
    <ClientOnly>
      <SessionUnknownBanner />
    </ClientOnly>

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- Global UI Infrastructure -->
    <ClientOnly>
      <ModalHost />
      <ToastHost />
    </ClientOnly>

    <!-- Nonrendering legacy adapter for injected/template-ref callers -->
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
import BetaTestMailNotice from '~/components/auth/BetaTestMailNotice.vue'

// Preserve inject('toast').value.show without mounting another host.
const legacyToast = ref<InstanceType<typeof Toast> | null>(null)
provide('toast', legacyToast)

// Auth initialization moved to plugins/auth-init.ts
</script>
