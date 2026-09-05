<template>
  <div class="login-container">
    <div class="login-box">
      <header class="auth-appbar">
        <button type="button" @click="handleBack" class="back-btn press" aria-label="뒤로가기">
          <ChevronLeft :size="22" aria-hidden="true" />
        </button>
        <span class="step-label" aria-live="polite">{{ currentStep }} / 2</span>
      </header>
      <div
        class="step-progress"
        role="progressbar"
        aria-label="회원가입 진행 단계"
        :aria-valuenow="currentStep"
        aria-valuemin="0"
        aria-valuemax="2"
      >
        <div class="step-progress-fill" :class="{ 'is-complete': currentStep === 2 }" />
      </div>

      <main class="register-content stagger">
        <div class="register-intro">
          <NuxtImg
            src="/images/logo-transparent.png"
            alt="매일일독"
            class="logo"
            loading="eager"
            format="webp"
          />
          <h1 class="page-title">이메일로<br>계정을 만들어요</h1>
          <p class="page-description">인증 메일을 보내드려요. 닉네임은 나중에 바꿀 수 있어요.</p>
        </div>

        <form @submit.prevent="handleSubmit" class="login-form" :aria-busy="loading">
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
              :aria-invalid="!!emailError"
              :aria-describedby="emailError ? 'email-error' : undefined"
              @blur="checkEmail"
            >
            <p v-if="emailError" id="email-error" class="error-text" role="alert">{{ emailError }}</p>
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
              :aria-invalid="!!nicknameError"
              :aria-describedby="nicknameError || isNicknameChecked ? 'nickname-status' : undefined"
              @input="checkNickname"
            >
            <p v-if="nicknameError" id="nickname-status" class="error-text" role="alert">{{ nicknameError }}</p>
            <p v-else-if="isNicknameChecked" id="nickname-status" class="success-text" role="status">사용 가능한 닉네임입니다</p>
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
              :aria-invalid="!!passwordError"
              :aria-describedby="passwordError ? 'password-rules password-error' : 'password-rules'"
              @input="validatePassword"
            >
            <ul id="password-rules" class="password-rules" aria-live="polite">
              <li :class="{ fulfilled: hasMinimumLength }">
                <Check v-if="hasMinimumLength" :size="12" :stroke-width="3" aria-hidden="true" />
                <span v-else class="rule-marker" aria-hidden="true" />
                8자 이상<span class="visually-hidden">{{ hasMinimumLength ? ' 충족' : ' 미충족' }}</span>
              </li>
              <li :class="{ fulfilled: hasLetterAndNumber }">
                <Check v-if="hasLetterAndNumber" :size="12" :stroke-width="3" aria-hidden="true" />
                <span v-else class="rule-marker" aria-hidden="true" />
                문자+숫자<span class="visually-hidden">{{ hasLetterAndNumber ? ' 충족' : ' 미충족' }}</span>
              </li>
            </ul>
            <p v-if="passwordError" id="password-error" class="error-text" role="alert">{{ passwordError }}</p>
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
              :aria-invalid="!!passwordConfirmError"
              :aria-describedby="passwordConfirmError || (password && passwordConfirm && password === passwordConfirm) ? 'password-confirm-status' : undefined"
              @input="validatePasswordConfirm"
            >
            <p v-if="passwordConfirmError" id="password-confirm-status" class="error-text" role="alert">{{ passwordConfirmError }}</p>
            <p v-else-if="password && passwordConfirm && password === passwordConfirm" id="password-confirm-status" class="success-text" role="status">비밀번호가 일치합니다</p>
          </div>

          <div class="terms-consent">
            <label class="consent-control">
              <input v-model="termsAccepted" type="checkbox" required class="consent-input">
              <span class="consent-box" aria-hidden="true"><Check v-if="termsAccepted" :size="14" :stroke-width="3" /></span>
              <span class="visually-hidden">이용약관과 개인정보처리방침에 동의합니다</span>
            </label>
            <p><NuxtLink to="/terms" class="press">이용약관</NuxtLink>과 <NuxtLink to="/privacy" class="press">개인정보처리방침</NuxtLink>에 동의합니다</p>
          </div>

          <AppButton type="submit" variant="primary" size="lg" block class="submit-button primary-button" :disabled="loading || !isFormValid" :loading="loading">
            {{ loading ? '가입 중...' : '인증 메일 받기' }}
          </AppButton>

          <div class="register-section">
            <NuxtLink to="/login" class="register-link press">
              이미 계정이 있으신가요? 로그인하기
            </NuxtLink>
          </div>
        </form>

        <footer class="legal-links">
          <NuxtLink to="/terms" class="press">이용약관</NuxtLink>
          <span aria-hidden="true">·</span>
          <NuxtLink to="/privacy" class="press">개인정보처리방침</NuxtLink>
          <span aria-hidden="true">·</span>
          <NuxtLink to="/company" class="press">사업자 정보</NuxtLink>
        </footer>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Check, ChevronLeft } from '@lucide/vue'
import AppButton from '~/components/ui/AppButton.vue'
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
const currentStep = ref(1)
const termsAccepted = ref(false)
const hasMinimumLength = computed(() => password.value.length >= 8)
const hasLetterAndNumber = computed(() => /[a-zA-Z]/.test(password.value) && /\d/.test(password.value))

const emailError = ref('')
const nicknameError = ref('')
const passwordError = ref('')
const passwordConfirmError = ref('')
const isEmailChecked = ref(false)
const isNicknameChecked = ref(false)

let nicknameCheckTimeout: ReturnType<typeof setTimeout> | null = null

const isFormValid = computed(() => {
  return Boolean(
    termsAccepted.value &&
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
      const response = await api.POST('/api/v1/auth/check-nickname/', { nickname: value })
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
    const response = await api.POST('/api/v1/auth/email-register/', {
      email: email.value,
      password: password.value,
      password_confirm: passwordConfirm.value,
      nickname: nickname.value
    })

    const data = response

    if (data.access) {
      auth.setTokens(data.access, data.refresh)
      auth.setUser(data.user as Parameters<typeof auth.setUser>[0])
      
      try {
        await api.POST('/api/v1/auth/send-verification/', { email: email.value })
      } catch (e) {
        // ignore if verification email fails
      }
      
      currentStep.value = 2
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
  min-height: 100dvh;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  letter-spacing: var(--tracking-body);
  padding-top: env(safe-area-inset-top, 0px);
}
.login-box {
  width: 100%;
  max-width: 480px;
  min-height: inherit;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
}
.auth-appbar {
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-inline: 8px;
}
.back-btn {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--color-text-primary);
}
.back-btn:hover { background: var(--color-bg-hover); }
.step-label { padding-right: 12px; font-size: 12px; font-weight: 600; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
.step-progress {
  height: 3px;
  flex-shrink: 0;
  margin-inline: var(--screen-gutter);
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-border-default);
}
.step-progress-fill {
  width: 50%;
  height: 100%;
  border-radius: inherit;
  background: var(--color-accent-primary);
  transition: width var(--duration-standard) ease;
}
.step-progress-fill.is-complete { width: 100%; }
.register-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px var(--screen-gutter) max(12px, env(safe-area-inset-bottom, 0px));
}
.logo { display: block; height: 34px; width: auto; object-fit: contain; margin-bottom: 20px; }
:global([data-theme="dark"]) .logo { filter: brightness(0) invert(1); }
.page-title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: var(--tracking-display);
}
.page-description { margin: 0; font-size: 14px; line-height: 1.5; color: var(--color-text-secondary); }
.login-form { flex: 1; display: flex; flex-direction: column; gap: 14px; margin-top: 32px; }
.input-wrapper { display: flex; flex-direction: column; gap: 6px; }
.input-label { padding-left: 12px; font-size: 12px; font-weight: 600; line-height: 1.4; color: var(--color-text-secondary); }
.form-input {
  appearance: none;
  display: block;
  width: 100%;
  height: 52px;
  padding: 0 20px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-pill);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  transition: border-color var(--duration-micro) ease, box-shadow var(--duration-micro) ease;
}
.form-input::placeholder { color: var(--color-text-tertiary); }
.form-input.input-error { border-color: var(--color-error); }
.form-input.input-success { border-color: var(--color-accent-primary); }
.form-input:focus, .form-input:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 3px var(--color-accent-focus-ring);
}
.error-text, .success-text { margin: 0; padding-inline: 12px; font-size: 12px; line-height: 1.4; }
.error-text { color: var(--color-error); }
.success-text { color: var(--color-accent-primary); }
.password-rules { display: flex; gap: 12px; list-style: none; margin: 0; padding-left: 12px; font-size: 12px; color: var(--color-text-secondary); }
.password-rules li { display: flex; align-items: center; gap: 4px; }
.password-rules .fulfilled { color: var(--color-accent-primary); }
.rule-marker { width: 12px; height: 12px; border: 1px solid var(--color-border-default); border-radius: 50%; }
.terms-consent { display: flex; align-items: flex-start; gap: 4px; margin-top: 8px; font-size: 13px; line-height: 1.5; color: var(--color-text-secondary); }
.terms-consent p { margin: 0; }
.terms-consent a { font-weight: 600; }
.consent-control { position: relative; width: 44px; height: 44px; flex-shrink: 0; display: grid; place-items: center; cursor: pointer; }
.consent-input { position: absolute; inset: 0; width: 44px; height: 44px; margin: 0; opacity: 0; cursor: pointer; }
.consent-box { width: 18px; height: 18px; display: grid; place-items: center; border: 1px solid var(--color-border-default); border-radius: var(--radius-cell); background: var(--color-bg-card); color: var(--color-text-inverse); pointer-events: none; }
.consent-input:checked + .consent-box { background: var(--color-accent-primary); border-color: var(--color-accent-primary); color: var(--color-text-inverse); }
.consent-control:hover .consent-box { border-color: var(--color-accent-primary); }
.consent-input:focus-visible + .consent-box { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.submit-button { margin-top: auto; }
.register-section { text-align: center; font-size: 13px; font-weight: 500; }
.register-link, .terms-consent a, .legal-links a { display: inline-flex; align-items: center; justify-content: center; color: var(--color-accent-primary); text-decoration: none; border-radius: var(--radius-pill); }
.legal-links { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px; font-size: 11px; color: var(--color-text-tertiary); }
.legal-links a { color: var(--color-text-tertiary); }
a:hover { color: var(--color-accent-primary); background: var(--color-bg-hover); }
.back-btn:focus-visible, a:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (min-width: 768px) {
  .login-container { padding-block: 32px; }
  .login-box { min-height: calc(100dvh - 64px); }
}
@media (prefers-reduced-motion: reduce) {
  .step-progress-fill, .form-input { transition: none; }
}
</style>
