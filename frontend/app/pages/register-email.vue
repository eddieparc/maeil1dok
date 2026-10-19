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
        <section v-if="currentStep === 2" class="signup-status" :data-state="mailState" aria-live="polite">
          <CircleCheck :size="64" class="signup-icon" aria-hidden="true" />
          <h1 class="page-title">계정을 만들었어요</h1>
          <p class="page-description">{{ registeredEmail }}</p>
          <p v-if="mailState === 'pending'" role="status">인증 메일을 요청하는 중이에요.</p>
          <p v-else-if="mailState === 'requested'">인증 메일을 요청했어요. 메일함과 스팸 폴더를 확인해주세요.</p>
          <p v-else class="error-text" role="alert">{{ mailError }}</p>
          <AppButton variant="secondary" block :loading="mailState === 'pending'" @click="requestVerification">인증 메일 다시 요청하기</AppButton>
          <AppButton block @click="continueAfterSignup">시작하기</AppButton>
        </section>
        <div v-if="currentStep === 1" class="register-intro">
          <NuxtImg
            :src="cdnAsset('/images/logo-transparent.png')"
            alt="매일일독"
            class="logo"
            loading="eager"
            format="webp"
          />
          <h1 class="page-title">이메일로<br>계정을 만들어요</h1>
          <p class="page-description">인증 메일을 보내드려요. 닉네임은 나중에 바꿀 수 있어요.</p>
        </div>

        <form v-if="currentStep === 1" @submit.prevent="handleSubmit" class="login-form" :aria-busy="loading">
          <div class="input-wrapper">
            <label for="email" class="input-label">이메일</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="form-input"
              :class="{ 'input-error': emailError }"
              placeholder="example@email.com"
              :aria-invalid="!!emailError"
              :aria-describedby="emailError ? 'email-error' : 'email-hint'"
              :disabled="loading"
              @input="emailError = ''"
              @blur="checkEmail"
            >
            <p v-if="emailError" id="email-error" class="error-text" role="alert">{{ emailError }}</p>
            <p v-else id="email-hint" class="field-hint">이메일 중복 여부는 가입할 때 확인해요.</p>
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
              :aria-describedby="nicknameError || isNicknameChecked || checkingNickname ? 'nickname-status' : undefined"
              :disabled="loading"
              maxlength="20"
            >
            <p v-if="nicknameError" id="nickname-status" class="error-text" role="alert">{{ nicknameError }}</p>
            <p v-else-if="checkingNickname" id="nickname-status" class="field-hint" role="status">닉네임 확인 중...</p>
            <p v-else-if="isNicknameChecked" id="nickname-status" class="success-text" role="status">사용 가능한 닉네임입니다</p>
            <AppButton v-if="nicknameError && !checkingNickname" variant="ghost" size="sm" @click="checkNickname">다시 확인하기</AppButton>
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
              :disabled="loading"
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
            <AuthPasswordStrength :password="password" />
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
              :disabled="loading"
            >
            <p v-if="passwordConfirmError" id="password-confirm-status" class="error-text" role="alert">{{ passwordConfirmError }}</p>
            <p v-else-if="password && passwordConfirm && password === passwordConfirm" id="password-confirm-status" class="success-text" role="status">비밀번호가 일치합니다</p>
          </div>

          <div class="terms-consent">
            <label class="consent-control">
              <input v-model="termsAccepted" type="checkbox" required class="consent-input" :disabled="loading">
              <span class="consent-box" aria-hidden="true"><Check v-if="termsAccepted" :size="14" :stroke-width="3" /></span>
              <span class="visually-hidden">이용약관과 개인정보처리방침에 동의합니다</span>
            </label>
            <p><NuxtLink to="/terms" class="press">이용약관</NuxtLink>과 <NuxtLink to="/privacy" class="press">개인정보처리방침</NuxtLink>에 동의합니다</p>
          </div>

          <p v-if="submitError" class="error-text" role="alert">{{ submitError }}</p>
          <code v-if="submitCode" class="error-text">code: {{ submitCode }}</code>
          <AppButton type="submit" variant="primary" size="lg" block class="submit-button primary-button" :disabled="loading || !isFormValid" :loading="loading">
            {{ loading ? '가입 중...' : '가입하기' }}
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
import { useCdnAsset } from '~/composables/useCdnAsset';
import { ref, computed } from 'vue'
import { Check, ChevronLeft, CircleCheck } from '@lucide/vue'
import AuthPasswordStrength from '~/components/auth/AuthPasswordStrength.vue'
import { useAuthNicknameField } from '~/composables/useAuthNicknameField'
import { authErrorCode, authErrorData, authErrorMessage, hasAuthLetterAndNumber, isAuthEmailFormat, isAuthPasswordValid } from '~/utils/authFormUi'
import AppButton from '~/components/ui/AppButton.vue'
import { useAuthService } from '~/composables/useAuthService'
import { useHead } from '#imports'
import { useModal } from '~/composables/useModal'
import { useNavigation } from '~/composables/useNavigation'
import { useApi } from '~/composables/useApi'
const { cdnAsset } = useCdnAsset();

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
const hasLetterAndNumber = computed(() => hasAuthLetterAndNumber(password.value))
const emailError = ref('')
const { nicknameError, isNicknameChecked, checkingNickname, checkNickname } = useAuthNicknameField(nickname)
const passwordError = computed(() => password.value && !isAuthPasswordValid(password.value) ? '비밀번호는 8자 이상 문자와 숫자를 포함해주세요.' : '')
const passwordConfirmError = computed(() => passwordConfirm.value && password.value !== passwordConfirm.value ? '비밀번호가 일치하지 않습니다.' : '')
const submitError = ref('')
const submitCode = ref('')
const registeredEmail = ref('')
const mailState = ref<'idle' | 'pending' | 'requested' | 'error'>('idle')
const mailError = ref('')

const isFormValid = computed(() => {
  return Boolean(
    termsAccepted.value &&
    isAuthEmailFormat(email.value) &&
    nickname.value &&
    isAuthPasswordValid(password.value) &&
    passwordConfirm.value &&
    isNicknameChecked.value &&
    !emailError.value &&
    !nicknameError.value &&
    !passwordError.value &&
    !passwordConfirmError.value &&
    password.value === passwordConfirm.value
  )
})

const checkEmail = () => {
  emailError.value = email.value && !isAuthEmailFormat(email.value) ? '올바른 이메일 형식이 아닙니다.' : ''
}

const requestVerification = async () => {
  if (mailState.value === 'pending') return
  mailState.value = 'pending'
  mailError.value = ''
  try {
    const result = await api.POST('/api/v1/auth/send-verification/', { email: registeredEmail.value })
    if (!result.success) throw new Error('Verification request failed')
    mailState.value = 'requested'
  } catch (error) {
    mailState.value = 'error'
    mailError.value = authErrorMessage(error, '계정은 만들어졌지만 인증 메일을 요청하지 못했어요. 다시 요청해주세요.')
  }
}
const continueAfterSignup = () => navigateTo(consumeRedirectUrl() || '/')

const handleSubmit = async () => {
  if (loading.value || currentStep.value !== 1 || !isFormValid.value) return
  submitError.value = ''
  submitCode.value = ''
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
      
      registeredEmail.value = email.value
      currentStep.value = 2
      password.value = ''
      passwordConfirm.value = ''
      await requestVerification()
    } else {
      throw new Error('Registration failed')
    }
  } catch (error: unknown) {
    submitError.value = authErrorMessage(error, '회원가입에 실패했습니다.')
    submitCode.value = authErrorCode(error)
    const fields = authErrorData(error).errors as Record<string, unknown> | undefined
    if (Array.isArray(fields?.email)) emailError.value = String(fields.email[0])
    if (Array.isArray(fields?.nickname)) {
      nicknameError.value = String(fields.nickname[0])
      isNicknameChecked.value = false
    }
    await modal.alert({
      title: '회원가입 실패',
      description: submitError.value,
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
  width: 100%;
  height: 100%;
  transform: scaleX(.5);
  transform-origin: left;
  border-radius: inherit;
  background: var(--color-accent-primary);
  transition: transform var(--duration-standard) ease;
}
.step-progress-fill.is-complete { transform: scaleX(1); }
.register-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px var(--screen-gutter) max(12px, env(safe-area-inset-bottom, 0px));
}
.logo { display: block; height: 22px; width: auto; object-fit: contain; margin-bottom: 20px; }
:global([data-theme="dark"] .login-container .logo) { filter: brightness(0) invert(1); }
.page-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: var(--tracking-display);
}
.page-description { margin: 0; font-size: 13px; line-height: 1.5; color: var(--color-text-secondary); }
.login-form { flex: 1; display: flex; flex-direction: column; gap: 14px; margin-top: 32px; }
.input-wrapper { display: flex; flex-direction: column; gap: 6px; }
.input-label { padding-left: 12px; font-size: 12px; font-weight: 600; line-height: 1.4; color: var(--color-text-secondary); }
.form-input {
  appearance: none;
  display: block;
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 1px solid var(--color-border-default);
  border-radius: 14px;
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font: inherit;
  font-size: 14px;
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
.signup-status { display: flex; flex-direction: column; gap: 16px; text-align: center; padding-block: 40px; }
.signup-icon { margin-inline: auto; padding: 16px; border-radius: 50%; background: var(--color-accent-bg); color: var(--color-accent-primary); }
.field-hint { margin: 0; padding-inline: 12px; font-size: 12px; color: var(--color-text-secondary); }
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
.consent-box { width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid var(--color-border-default); border-radius: 7px; background: var(--color-bg-card); color: var(--color-text-inverse); pointer-events: none; }
.consent-input:checked + .consent-box { background: var(--color-accent-primary); border-color: var(--color-accent-primary); color: var(--color-text-inverse); }
.consent-control:hover .consent-box { border-color: var(--color-accent-primary); }
.consent-input:focus-visible + .consent-box { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.submit-button { margin-top: auto; }
.register-section { text-align: center; font-size: 13px; font-weight: 500; }
.register-link, .terms-consent a, .legal-links a { min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center; color: var(--color-accent-primary); text-decoration: none; border-radius: var(--radius-pill); }
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
