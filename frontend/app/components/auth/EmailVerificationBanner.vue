<template>
  <Transition name="banner">
    <div v-if="showBanner" class="email-verification-banner" role="alert">
      <div class="banner-content">
        <svg class="banner-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
        <span class="banner-message">
          이메일 인증이 완료되지 않았습니다.
          <button 
            type="button" 
            class="resend-link" 
            @click="handleResend"
            :disabled="resending || cooldown > 0"
          >
            {{ buttonText }}
          </button>
        </span>
      </div>
      <button type="button" class="banner-close" @click="dismiss" aria-label="닫기">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { useToast } from '~/composables/useToast'

const auth = useAuthService()
const api = useApi()
const toast = useToast()

const dismissed = ref(false)
const resending = ref(false)
const cooldown = ref(0)
let cooldownTimer: NodeJS.Timeout | null = null

// Show banner only for email-registered users who haven't verified
const showBanner = computed(() => {
  if (dismissed.value) return false
  if (!auth.user.value) return false
  // Only show for email-based accounts (has password set)
  if (!auth.user.value.email) return false
  if (!auth.user.value.has_usable_password_flag) return false  // 소셜 로그인 사용자는 제외
  // Don't show for already verified users
  if (auth.user.value.email_verified) return false
  return true
})

const buttonText = computed(() => {
  if (resending.value) return '전송 중...'
  if (cooldown.value > 0) return `${cooldown.value}초 후 재전송 가능`
  return '인증 메일 재전송'
})

function dismiss() {
  dismissed.value = true
  // Remember dismissal for this session
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('email_banner_dismissed', 'true')
  }
}

async function handleResend() {
  if (resending.value || cooldown.value > 0) return
  
  resending.value = true
  try {
    await api.POST('/api/v1/auth/resend-verification/')
    toast.success('인증 메일을 발송했습니다. 메일함을 확인해주세요.')
    startCooldown()
  } catch (error: any) {
    const message = error?.data?.error || error?.message || '메일 발송에 실패했습니다.'
    toast.error(message)
  } finally {
    resending.value = false
  }
}

function startCooldown() {
  cooldown.value = 60
  cooldownTimer = setInterval(() => {
    cooldown.value--
    if (cooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

onMounted(() => {
  // Check if banner was dismissed in this session
  if (typeof sessionStorage !== 'undefined') {
    dismissed.value = sessionStorage.getItem('email_banner_dismissed') === 'true'
  }
})

onUnmounted(() => {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
  }
})
</script>

<style scoped>
.email-verification-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background-color: #fef3c7;
  border-bottom: 1px solid #fcd34d;
  color: #92400e;
}

[data-theme="dark"] .email-verification-banner {
  background-color: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.3);
  color: #fcd34d;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  font-size: 0.875rem;
}

.banner-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.banner-message {
  line-height: 1.4;
}

.resend-link {
  font-weight: 500;
  color: inherit;
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  margin-left: 0.25rem;
  transition: opacity 0.2s;
}

.resend-link:hover:not(:disabled) {
  opacity: 0.8;
}

.resend-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  text-decoration: none;
}

.banner-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 0.25rem;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s, background-color 0.2s;
  flex-shrink: 0;
}

.banner-close:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] .banner-close:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.banner-close svg {
  width: 1rem;
  height: 1rem;
}

/* Transition animations */
.banner-enter-active,
.banner-leave-active {
  transition: all 0.3s ease;
}

.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

@media (max-width: 640px) {
  .email-verification-banner {
    padding: 0.625rem 0.75rem;
  }

  .banner-content {
    font-size: 0.8125rem;
  }
}
</style>
