<template>
  <div class="reset-container">
    <div class="reset-box">
      <div class="logo-container">
        <NuxtImg
          src="/images/logo-transparent.png"
          alt="매일일독"
          class="logo"
          loading="lazy"
          format="webp"
        />
      </div>

      <div v-if="loading" class="status-container">
        <div class="spinner"></div>
        <p class="status-text">토큰 확인 중...</p>
      </div>

      <div v-else-if="invalidToken" class="status-container error">
        <svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="status-title">링크가 만료되었습니다</h2>
        <p class="status-text">{{ errorMessage }}</p>
        <button @click="goToForgotPassword" class="action-button">
          새 링크 요청하기
        </button>
      </div>

      <div v-else-if="success" class="status-container success">
        <svg class="status-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="status-title">비밀번호 변경 완료!</h2>
        <p class="status-text">새 비밀번호로 로그인할 수 있습니다.</p>
        <button @click="goToHome" class="action-button">
          시작하기
        </button>
      </div>

      <div v-else class="form-container">
        <h2 class="title">새 비밀번호 설정</h2>
        <p class="description">
          새로운 비밀번호를 입력해주세요.
        </p>

        <form @submit.prevent="handleSubmit" class="reset-form">
          <div class="input-group">
            <label for="password" class="visually-hidden">새 비밀번호</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
              class="form-input input-top"
              placeholder="새 비밀번호 (8자 이상)"
            >

            <label for="confirmPassword" class="visually-hidden">비밀번호 확인</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              required
              autocomplete="new-password"
              class="form-input input-bottom"
              placeholder="비밀번호 확인"
            >
          </div>

          <p v-if="passwordError" class="error-text">{{ passwordError }}</p>

          <button type="submit" class="submit-button" :disabled="submitting">
            {{ submitting ? '변경 중...' : '비밀번호 변경' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { useHead } from '#imports'

useHead({
  title: '비밀번호 재설정 - 매일일독',
  meta: [
    { name: 'robots', content: 'noindex' }
  ]
})

const route = useRoute()
const router = useRouter()
const auth = useAuthService()
const api = useApi()

const loading = ref(true)
const invalidToken = ref(false)
const success = ref(false)
const errorMessage = ref('')
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const token = ref('')

const passwordError = computed(() => {
  if (password.value && password.value.length < 8) {
    return '비밀번호는 8자 이상이어야 합니다.'
  }
  if (confirmPassword.value && password.value !== confirmPassword.value) {
    return '비밀번호가 일치하지 않습니다.'
  }
  return ''
})

onMounted(async () => {
  token.value = route.query.token
  
  if (!token.value) {
    loading.value = false
    invalidToken.value = true
    errorMessage.value = '재설정 토큰이 없습니다.'
    return
  }

  try {
    const response = await api.post('/api/v1/auth/verify-reset-token/', { token: token.value })
    const data = response.data || response
    
    if (!data.valid) {
      invalidToken.value = true
      errorMessage.value = data.error || '유효하지 않은 링크입니다.'
    }
  } catch (error) {
    invalidToken.value = true
    const errorData = error.response?.data || {}
    errorMessage.value = errorData.error || '링크 확인 중 오류가 발생했습니다.'
  } finally {
    loading.value = false
  }
})

const handleSubmit = async () => {
  if (passwordError.value) return
  if (password.value !== confirmPassword.value) return

  submitting.value = true
  try {
    const response = await api.post('/api/v1/auth/reset-password/', {
      token: token.value,
      new_password: password.value
    })
    const data = response.data || response
    
    if (data.success) {
      success.value = true
      
      if (data.access) {
        auth.setTokens(data.access, data.refresh)
        await auth.fetchUser()
      }
    }
  } catch (error) {
    const errorData = error.response?.data || {}
    if (errorData.error?.includes('만료')) {
      invalidToken.value = true
      errorMessage.value = errorData.error
    } else {
      errorMessage.value = errorData.error || '비밀번호 변경 중 오류가 발생했습니다.'
    }
  } finally {
    submitting.value = false
  }
}

const goToForgotPassword = () => {
  router.push('/auth/forgot-password')
}

const goToHome = () => {
  router.push('/')
}
</script>

<style scoped>
.reset-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-base);
  padding: 2rem 1rem;
}

.reset-box {
  width: 100%;
  max-width: 28rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
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
  text-align: center;
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

.form-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 2rem;
  background-color: var(--color-bg-card);
  border-radius: 0.75rem;
  box-shadow: var(--shadow-sm);
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-slate-800);
  text-align: center;
  margin: 0;
}

.description {
  font-size: 0.875rem;
  color: var(--color-slate-600);
  text-align: center;
  margin: 0;
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
  border-radius: 0.375rem;
  overflow: hidden;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.form-input {
  appearance: none;
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-slate-300);
  background-color: var(--color-bg-card);
  color: var(--color-slate-800);
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.form-input::placeholder {
  color: var(--color-slate-400);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent-secondary);
  box-shadow: 0 0 0 3px var(--color-accent-bg);
  z-index: 10;
  position: relative;
}

.input-top {
  border-top-left-radius: 0.375rem;
  border-top-right-radius: 0.375rem;
  border-bottom: none;
}

.input-bottom {
  border-bottom-left-radius: 0.375rem;
  border-bottom-right-radius: 0.375rem;
}

.error-text {
  font-size: 0.75rem;
  color: #EF4444;
  margin: -0.5rem 0 0 0;
}

.submit-button,
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

.submit-button:hover:not(:disabled),
.action-button:hover:not(:disabled) {
  background-color: var(--primary-dark);
  transform: translateY(-1px);
}

.submit-button:disabled,
.action-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
