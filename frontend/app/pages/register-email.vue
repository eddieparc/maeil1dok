<template>
  <div class="login-container">
    <div class="login-box">
      <!-- Back Button -->
      <button @click="handleBack" class="back-btn">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>

      <!-- 로고 -->
      <div class="logo-container">
        <NuxtImg
          src="/images/logo-transparent.png"
          alt="매일일독"
          class="logo"
          loading="eager"
          format="webp"
        />
      </div>

      <h1 class="page-title">이메일로 회원가입</h1>

      <!-- 회원가입 폼 -->
      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="input-wrapper">
          <label for="email" class="input-label">이메일</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="form-input"
            :class="{ 'input-error': emailError, 'input-success': isEmailChecked && !emailError }"
            placeholder="example@email.com"
            @blur="checkEmail"
          >
          <p v-if="emailError" class="error-text">{{ emailError }}</p>
        </div>

        <div class="input-wrapper">
          <label for="nickname" class="input-label">닉네임</label>
          <input
            id="nickname"
            v-model="nickname"
            type="text"
            required
            autocomplete="nickname"
            class="form-input"
            :class="{ 'input-error': nicknameError, 'input-success': isNicknameChecked && !nicknameError }"
            placeholder="2자 이상 닉네임"
            @input="checkNickname"
          >
          <p v-if="nicknameError" class="error-text">{{ nicknameError }}</p>
          <p v-else-if="isNicknameChecked" class="success-text">사용 가능한 닉네임입니다</p>
        </div>

        <div class="input-wrapper">
          <label for="password" class="input-label">비밀번호</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="new-password"
            class="form-input"
            :class="{ 'input-error': passwordError }"
            placeholder="8자 이상 (문자+숫자 포함)"
            @input="validatePassword"
          >
          <p v-if="passwordError" class="error-text">{{ passwordError }}</p>
        </div>

        <div class="input-wrapper">
          <label for="passwordConfirm" class="input-label">비밀번호 확인</label>
          <input
            id="passwordConfirm"
            v-model="passwordConfirm"
            type="password"
            required
            autocomplete="new-password"
            class="form-input"
            :class="{ 'input-error': passwordConfirmError, 'input-success': password && passwordConfirm && password === passwordConfirm }"
            placeholder="비밀번호 재입력"
            @input="validatePasswordConfirm"
          >
          <p v-if="passwordConfirmError" class="error-text">{{ passwordConfirmError }}</p>
          <p v-else-if="password && passwordConfirm && password === passwordConfirm" class="success-text">비밀번호가 일치합니다</p>
        </div>

        <button type="submit" class="submit-button" :disabled="loading || !isFormValid">
          {{ loading ? '가입 중...' : '회원가입' }}
        </button>

        <div class="register-section">
          <NuxtLink to="/login" class="register-link">
            이미 계정이 있으신가요? 로그인하기
          </NuxtLink>
        </div>
      </form>

      <!-- 하단 법적 링크 -->
      <div class="legal-links">
        <NuxtLink to="/terms">이용약관</NuxtLink>
        <span class="divider-dot">|</span>
        <NuxtLink to="/privacy">개인정보처리방침</NuxtLink>
        <span class="divider-dot">|</span>
        <NuxtLink to="/company">사업자 정보</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthService } from '~/composables/useAuthService'
import { useHead } from '#imports'
import { useModal } from '~/composables/useModal'
import { useNavigation } from '~/composables/useNavigation'
import { useApi } from '~/composables/useApi'

useHead({
  title: '회원가입 - 매일일독',
  meta: [
    { name: 'description', content: '매일일독에 회원가입하여 성경 통독을 시작하세요.' },
    { property: 'og:title', content: '회원가입 - 매일일독' },
    { property: 'og:description', content: '매일일독에 회원가입하여 성경 통독을 시작하세요.' },
  ],
})

const auth = useAuthService()
const modal = useModal()
const api = useApi()
const { goBack, consumeRedirectUrl } = useNavigation()

const email = ref('')
const nickname = ref('')
const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)

const emailError = ref('')
const nicknameError = ref('')
const passwordError = ref('')
const passwordConfirmError = ref('')
const isEmailChecked = ref(false)
const isNicknameChecked = ref(false)

let nicknameCheckTimeout: ReturnType<typeof setTimeout> | null = null

const isFormValid = computed(() => {
  return (
    email.value &&
    nickname.value &&
    password.value &&
    passwordConfirm.value &&
    isNicknameChecked.value &&
    !emailError.value &&
    !nicknameError.value &&
    !passwordError.value &&
    !passwordConfirmError.value &&
    password.value === passwordConfirm.value
  )
})

const checkEmail = async () => {
  emailError.value = ''
  isEmailChecked.value = false
  
  const value = email.value.trim()
  if (!value) return
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    emailError.value = '올바른 이메일 형식이 아닙니다'
    return
  }
  
  isEmailChecked.value = true
}

const checkNickname = async () => {
  nicknameError.value = ''
  isNicknameChecked.value = false
  
  if (nicknameCheckTimeout) {
    clearTimeout(nicknameCheckTimeout)
  }
  
  const value = nickname.value.trim()
  
  if (value.length < 2) {
    nicknameError.value = '닉네임은 2자 이상이어야 합니다'
    return
  }
  
  if (value.length > 20) {
    nicknameError.value = '닉네임은 20자 이하여야 합니다'
    return
  }
  
  nicknameCheckTimeout = setTimeout(async () => {
    try {
      const response = await api.post('/api/v1/auth/check-nickname/', { nickname: value })
      if (response.available) {
        isNicknameChecked.value = true
        nicknameError.value = ''
      } else {
        nicknameError.value = '이미 사용 중인 닉네임입니다'
      }
    } catch (error) {
      nicknameError.value = '닉네임 확인 중 오류가 발생했습니다'
    }
  }, 300)
}

const validatePassword = () => {
  passwordError.value = ''
  const value = password.value
  
  if (value.length < 8) {
    passwordError.value = '비밀번호는 8자 이상이어야 합니다'
    return
  }
  
  if (!/\d/.test(value)) {
    passwordError.value = '비밀번호는 최소 1개의 숫자를 포함해야 합니다'
    return
  }
  
  if (!/[a-zA-Z]/.test(value)) {
    passwordError.value = '비밀번호는 최소 1개의 문자를 포함해야 합니다'
    return
  }
  
  // Re-validate confirm if already entered
  if (passwordConfirm.value) {
    validatePasswordConfirm()
  }
}

const validatePasswordConfirm = () => {
  passwordConfirmError.value = ''
  
  if (passwordConfirm.value && password.value !== passwordConfirm.value) {
    passwordConfirmError.value = '비밀번호가 일치하지 않습니다'
  }
}

const handleSubmit = async () => {
  if (!isFormValid.value) return
  
  loading.value = true
  try {
    const response = await api.post('/api/v1/auth/email-register/', {
      email: email.value,
      password: password.value,
      password_confirm: passwordConfirm.value,
      nickname: nickname.value
    })

    const data = response.data || response

    if (data.access) {
      auth.setTokens(data.access, data.refresh)
      auth.setUser(data.user)
      
      try {
        await api.post('/api/v1/auth/send-verification/', { email: email.value })
      } catch (e) {
        // ignore if verification email fails
      }
      
      await modal.alert({
        title: '회원가입 완료',
        description: `${email.value}로 인증 메일을 보냈습니다. 이메일을 확인하여 인증을 완료해주세요.`,
        icon: 'success'
      })
      
      const redirectPath = consumeRedirectUrl() || '/'
      navigateTo(redirectPath)
    } else {
      throw new Error('Registration failed')
    }
  } catch (error: any) {
    const message = error?.data?.error || error?.message || '회원가입에 실패했습니다.'
    await modal.alert({
      title: '회원가입 실패',
      description: message,
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  goBack('/login')
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-base);
  padding: 3rem 1rem;
}

.login-box {
  width: 100%;
  max-width: 28rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.back-btn {
  display: flex;
  align-items: center;
  color: var(--color-slate-500);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  margin: -0.5rem;
  transition: color 0.2s ease;
  align-self: flex-start;
}

.back-btn:hover {
  color: var(--color-slate-800);
}

.logo-container {
  text-align: center;
}

.logo {
  height: 2rem;
  width: auto;
  object-fit: contain;
  margin: 0 auto;
  transition: filter 0.2s ease;
}

[data-theme="dark"] .logo {
  filter: brightness(0) invert(1);
}

.page-title {
  text-align: center;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-slate-800);
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.input-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-slate-700);
}

.form-input {
  appearance: none;
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-slate-300);
  border-radius: 0.375rem;
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
}

.form-input.input-error {
  border-color: #ef4444;
}

.form-input.input-error:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.form-input.input-success {
  border-color: #22c55e;
}

.form-input.input-success:focus {
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.error-text {
  font-size: 0.75rem;
  color: #ef4444;
  margin: 0;
}

.success-text {
  font-size: 0.75rem;
  color: #22c55e;
  margin: 0;
}

.submit-button {
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
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  margin-top: 0.5rem;
}

.submit-button:hover:not(:disabled) {
  background-color: var(--primary-dark);
  transform: translateY(-1px);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.register-section {
  text-align: center;
  font-size: 0.875rem;
}

.register-link {
  display: inline-block;
  color: var(--primary-color);
  font-weight: 500;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.register-link:hover {
  background-color: var(--primary-light);
  color: var(--primary-dark);
}

.legal-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-slate-400);
  margin-top: 0.5rem;
}

.legal-links a {
  color: var(--color-slate-400);
  text-decoration: none;
  transition: color 0.2s ease;
}

.legal-links a:hover {
  color: var(--color-slate-600);
}

.legal-links .divider-dot {
  color: var(--color-slate-300);
}

@media (max-width: 640px) {
  .login-container {
    padding: 2rem 1rem;
  }

  .login-box {
    gap: 1.25rem;
  }
}

@media (min-width: 768px) {
  .login-container {
    padding: 3rem 2rem;
  }

  .login-box {
    max-width: 480px;
    gap: 1.5rem;
    padding: 2.5rem;
  }
}
</style>
