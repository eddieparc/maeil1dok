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

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- Global UI Infrastructure -->
    <ClientOnly>
      <ModalHost />
      <ToastHost />
    </ClientOnly>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ModalHost from '~/components/ui/modal/ModalHost.vue'
import ToastHost from '~/components/ui/toast/ToastHost.vue'
import EmailVerificationBanner from '~/components/auth/EmailVerificationBanner.vue'
import SessionUnknownBanner from '~/components/auth/SessionUnknownBanner.vue'


// Auth initialization moved to plugins/auth-init.ts
</script>
