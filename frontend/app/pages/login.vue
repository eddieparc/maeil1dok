<template>
  <div class="login-container">
    <div class="login-box">
      <header class="auth-appbar">
        <button type="button" @click="handleBack" class="back-btn press" aria-label="뒤로가기">
          <ChevronLeft :size="22" aria-hidden="true" />
        </button>
      </header>

      <main class="login-content stagger">
        <div class="logo-container">
          <NuxtImg
            src="/images/logo-transparent.png"
            alt="매일일독"
            class="logo"
            loading="eager"
            format="webp"
          />
          <p class="tagline">매일 말씀과 함께, 기록은 여기에</p>
        </div>

        <div class="social-buttons">
          <button type="button" @click="handleKakaoLogin" class="social-button kakao-button press">
            <NuxtImg src="/images/kakao.png" width="18" height="18" alt="" loading="lazy" format="webp" />
            카카오로 시작하기
          </button>
          <button type="button" @click="handleGoogleLogin" class="social-button google-button press">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            구글로 시작하기
          </button>
          <button type="button" @click="handleAppleLogin" class="social-button apple-button auth-button press">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Apple로 시작하기
          </button>
        </div>

        <div class="divider"><span>또는 이메일로</span></div>

        <form @submit.prevent="handleSubmit" class="login-form" :aria-busy="loading">
          <div class="input-group">
            <label for="email" class="visually-hidden">이메일 또는 아이디</label>
            <input
              id="email"
              v-model="email"
              type="text"
              required
              autocomplete="username"
              class="form-input"
              placeholder="이메일 또는 아이디"
              :aria-invalid="!!loginError"
              :aria-describedby="loginError ? 'login-error' : undefined"
              @input="loginError = ''"
            >
            <label for="password" class="visually-hidden">비밀번호</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              class="form-input"
              placeholder="비밀번호"
              :aria-invalid="!!loginError"
              :aria-describedby="loginError ? 'login-error' : undefined"
              @input="loginError = ''"
            >
          </div>
          <p v-if="loginError" id="login-error" class="error-text" role="alert">{{ loginError }}</p>
          <code v-if="loginError && loginCode" class="error-text">code: {{ loginCode }}</code>
          <AppButton
            type="submit"
            variant="primary"
            size="lg"
            block
            class="submit-button primary-button"
            :disabled="isSubmitDisabled"
            :loading="loading"
          >
            {{ loading ? '로그인 중...' : '로그인' }}
          </AppButton>
          <div class="auth-links">
            <NuxtLink to="/auth/forgot-password" class="forgot-link press">비밀번호 찾기</NuxtLink>
            <span class="link-separator" aria-hidden="true">|</span>
            <NuxtLink to="/register-email" class="register-link press">이메일로 회원가입</NuxtLink>
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

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ChevronLeft } from '@lucide/vue'
import AppButton from '~/components/ui/AppButton.vue'
import { useAuthService } from '~/composables/useAuthService'
import { useRoute } from 'vue-router'
import { useRuntimeConfig } from 'nuxt/app'
import { useHead } from '#imports'
import { useModal } from '~/composables/useModal'
import { useNavigation } from '~/composables/useNavigation'
import { useApi } from '~/composables/useApi'
import { resolveSocialRedirectUri } from '#shared/utils/authCallbackRuntime'
import { authErrorCode, authErrorMessage } from '~/utils/authFormUi'

useHead({
  title: '로그인 - 매일일독',
  meta: [
    { name: 'description', content: '매일일독에 로그인하여 성경 통독 진행률을 확인하세요. 카카오, 구글, 이메일 로그인을 지원합니다.' },
    { property: 'og:title', content: '로그인 - 매일일독' },
    { property: 'og:description', content: '매일일독에 로그인하여 성경 통독 진행률을 확인하세요.' },
    { property: 'og:url', content: 'https://maeil1dok.app/login' },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'ko_KR' },
    { property: 'og:site_name', content: '매일일독' },
  ],
  link: [
    { rel: 'canonical', href: 'https://maeil1dok.app/login' },
  ],
})

const auth = useAuthService()
const config = useRuntimeConfig()
const modal = useModal()
const { goBack, consumeRedirectUrl, setRedirectUrl } = useNavigation()
const email = ref('')
const password = ref('')
const loading = ref(false)
const loginError = ref('')
const loginCode = ref('')
const isSubmitDisabled = computed(() => loading.value || !email.value.trim() || !password.value)
const route = useRoute()

onMounted(() => {
  const queryRedirect = String(route.query.redirect || '')
  if (queryRedirect) {
    setRedirectUrl(queryRedirect)
  }
})

const handleSubmit = async () => {
  if (isSubmitDisabled.value) return
  loginError.value = ''
  loginCode.value = ''
  loading.value = true
  const api = useApi()
  try {
    const data = await api.POST('/api/v1/auth/email-login/', {
      email: email.value,
      password: password.value
    })

    if (data.access) {
      auth.setTokens(data.access, data.refresh)
      await auth.fetchUser()
      const redirectPath = consumeRedirectUrl() || '/'
      navigateTo(redirectPath)
    } else {
      throw new Error('Login failed')
    }
  } catch (error) {
    loginError.value = authErrorMessage(error, '로그인하지 못했어요. 연결 상태와 이메일 또는 비밀번호를 확인해주세요.')
    loginCode.value = authErrorCode(error)
    await modal.alert({
      title: '로그인 실패',
      description: loginError.value,
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
}

const handleKakaoLogin = () => {
  const redirectUri = encodeURIComponent(resolveSocialRedirectUri(
    'kakao',
    config.public.KAKAO_REDIRECT_URI,
    window.location.origin,
  ))
  // scope: profile_nickname, profile_image, account_email 권한 요청
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${config.public.KAKAO_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=profile_nickname,profile_image,account_email`
  window.location.href = kakaoAuthUrl
}

const handleGoogleLogin = () => {
  const redirectUri = encodeURIComponent(resolveSocialRedirectUri(
    'google',
    config.public.GOOGLE_REDIRECT_URI,
    window.location.origin,
  ))
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.public.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&access_type=offline&prompt=consent`
  window.location.href = googleAuthUrl
}

const handleAppleLogin = () => {
  const clientId = config.public.APPLE_CLIENT_ID
  const redirectUri = encodeURIComponent(resolveSocialRedirectUri(
    'apple',
    config.public.APPLE_REDIRECT_URI,
    window.location.origin,
  ))
  const appleAuthUrl = `https://appleid.apple.com/auth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code%20id_token&scope=name%20email&response_mode=form_post`
  window.location.href = appleAuthUrl
}

const handleBack = () => {
  goBack('/')
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
.login-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 36px var(--screen-gutter) max(12px, env(safe-area-inset-bottom, 0px));
}
.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin-bottom: 44px;
}
.logo { height: 22px; width: auto; object-fit: contain; }
:global([data-theme="dark"] .login-container .logo) { filter: brightness(0) invert(1); }
.tagline { margin: 0; font-size: 14px; line-height: 1.5; color: var(--color-text-secondary); }
.social-buttons { display: flex; flex-direction: column; gap: 10px; }
.social-button {
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 20px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease;
}
.kakao-button { background: var(--color-kakao-bg); color: var(--color-kakao-text); }
.kakao-button:hover { background: var(--color-kakao-hover); }
.google-button {
  background: var(--color-apple-text);
  color: var(--color-apple-bg);
  border-color: var(--color-border-default);
}
.google-button:hover { background: var(--color-button-hover); }
.apple-button { background: var(--color-apple-bg); color: var(--color-apple-text); }
.apple-button:hover { background: var(--color-accent-primary-hover); }
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 28px 0 20px;
  color: var(--color-text-tertiary);
  font-size: 12px;
  line-height: 1.4;
}
.divider::before, .divider::after { content: ''; height: 1px; flex: 1; background: var(--color-border-default); }
.login-form, .input-group { display: flex; flex-direction: column; gap: 10px; }
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.form-input {
  appearance: none;
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
.form-input:focus, .form-input:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 3px var(--color-accent-focus-ring);
}
.form-input[aria-invalid="true"] { border-color: var(--color-error); }
.error-text { margin: 0; padding-inline: 12px; color: var(--color-error); font-size: 12px; line-height: 1.4; }
.submit-button { margin-top: 6px; }
.auth-links {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 8px;
  font-size: 13px;
  font-weight: 500;
}
.auth-links a, .legal-links a { min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; border-radius: var(--radius-pill); }
.auth-links .forgot-link { color: var(--color-text-secondary); }
.auth-links .register-link { color: var(--color-accent-primary); }
.link-separator { color: var(--color-border-default); }
.legal-links {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: auto;
  padding-top: 24px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.legal-links a { color: var(--color-text-tertiary); }
.auth-links a:hover, .legal-links a:hover { color: var(--color-accent-primary); background: var(--color-bg-hover); }
.back-btn:focus-visible, .social-button:focus-visible, a:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  border-color: var(--color-accent-primary);
}
@media (min-width: 768px) {
  .login-container { padding-block: 32px; }
  .login-box { min-height: calc(100dvh - 64px); }
}
@media (prefers-reduced-motion: reduce) {
  .social-button, .form-input { transition: none; }
}
</style>
