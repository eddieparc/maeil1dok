<template>
  <div class="verify-container">
    <div class="verify-box">
      <div class="logo-container">
        <NuxtImg
          src="/images/logo-transparent.png"
          alt="매일일독"
          class="logo"
          loading="eager"
          format="webp"
        />
      </div>

      <div v-if="loading" class="status-container">
        <div class="spinner"></div>
        <p class="status-text">이메일 인증 중...</p>
      </div>

      <div v-else-if="success" class="status-container success">
        <svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="status-title">이메일 인증 완료!</h2>
        <p class="status-text">{{ successMessage }}</p>
        <button @click="goToHome" class="action-button">
          시작하기
        </button>
      </div>

      <div v-else class="status-container error">
        <svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="status-title">인증 실패</h2>
        <p class="status-text">{{ errorMessage }}</p>
        <div class="action-buttons">
          <button @click="resendEmail" class="action-button secondary" :disabled="resending">
            {{ resending ? '발송 중...' : '인증 메일 재발송' }}
          </button>
          <button @click="goToLogin" class="action-button">
            로그인으로 이동
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { useHead } from '#imports'

useHead({
  title: '이메일 인증 - 매일일독',
  meta: [
    { name: 'robots', content: 'noindex' }
  ]
})

const route = useRoute()
const router = useRouter()
const auth = useAuthService()
const api = useApi()

const loading = ref(true)
const success = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const resending = ref(false)
const userEmail = ref('')

onMounted(async () => {
  const token = route.query.token
  
  if (!token) {
    loading.value = false
    errorMessage.value = '인증 토큰이 없습니다.'
    return
  }

  try {
    const response = await api.POST('/api/v1/auth/verify-email/', { token })
    const data = response
    
    if (data.success) {
      success.value = true
      successMessage.value = '이메일 인증이 완료되었습니다. 이제 매일일독의 모든 기능을 사용할 수 있습니다.'
      
      if (data.access) {
        auth.setTokens(data.access, data.refresh)
        await auth.fetchUser()
      }
    }
  } catch (error) {
    const errorData = error.response?.data || {}
    errorMessage.value = errorData.error || '인증 처리 중 오류가 발생했습니다.'
  } finally {
    loading.value = false
  }
})

const resendEmail = async () => {
  if (!userEmail.value) {
    router.push('/login')
    return
  }
  
  resending.value = true
  try {
    await api.POST('/api/v1/auth/send-verification/', { email: userEmail.value })
    errorMessage.value = '인증 메일이 재발송되었습니다. 이메일을 확인해주세요.'
  } catch (error) {
    const errorData = error.response?.data || {}
    errorMessage.value = errorData.error || '메일 발송에 실패했습니다.'
  } finally {
    resending.value = false
  }
}

const goToHome = () => {
  router.push('/')
}

const goToLogin = () => {
  router.push('/login')
}
</script>

<style scoped>
.verify-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-base);
  padding: 2rem 1rem;
}

.verify-box {
  width: 100%;
  max-width: 28rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  text-align: center;
}

.logo-container {
  text-align: center;
  margin-bottom: 1rem;
}

.logo {
  height: 2rem;
  width: auto;
  object-fit: contain;
  margin: 0 auto;
}

[data-theme="dark"] .logo {
  filter: brightness(0) invert(1);
}

.status-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background-color: var(--color-bg-card);
  border-radius: 0.75rem;
  box-shadow: var(--shadow-sm);
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 3px solid var(--color-slate-200);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-icon {
  width: 4rem;
  height: 4rem;
}

.success .status-icon {
  color: #10B981;
}

.error .status-icon {
  color: #EF4444;
}

.status-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-slate-800);
  margin: 0;
}

.status-text {
  font-size: 0.875rem;
  color: var(--color-slate-600);
  margin: 0;
  line-height: 1.5;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.5rem;
}

.action-button {
  width: 100%;
  padding: 0.75rem 1.5rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover:not(:disabled) {
  background-color: var(--primary-dark);
  transform: translateY(-1px);
}

.action-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.action-button.secondary {
  background-color: var(--color-bg-base);
  color: var(--color-slate-700);
  border: 1px solid var(--color-slate-300);
}

.action-button.secondary:hover:not(:disabled) {
  background-color: var(--color-slate-100);
}
</style>
