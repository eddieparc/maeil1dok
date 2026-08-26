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

      <!-- 카카오 로그인 버튼 -->
      <div class="social-buttons">
        <button type="button" @click="handleKakaoLogin" class="kakao-button">
          <NuxtImg
            src="/images/kakao.png"
            width="16"
            height="16"
            alt="카카오 로고"
            loading="lazy"
            format="webp"
          />
          카카오로 시작하기
        </button>

         <!-- 구글 로그인 버튼 -->
         <button type="button" @click="handleGoogleLogin" class="google-button">
           <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
             <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
             <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
             <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
             <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
           </svg>
           구글로 시작하기
         </button>

         <!-- Apple 로그인 버튼 -->
         <button type="button" @click="handleAppleLogin" class="apple-button">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
             <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
           </svg>
           Apple로 시작하기
         </button>
       </div>

      <!-- 구분선 -->
      <div class="divider">
        <span>또는 이메일/아이디로 계속</span>
      </div>

      <!-- 이메일/아이디 로그인 폼 -->
      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="input-group">
          <label for="email" class="visually-hidden">이메일 또는 아이디</label>
          <input
            id="email"
            v-model="email"
            type="text"
            required
            autocomplete="username"
            class="form-input input-top"
            placeholder="이메일 또는 아이디"
          >

          <label for="password" class="visually-hidden">비밀번호</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="form-input input-bottom"
            placeholder="비밀번호"
          >
        </div>

        <button type="submit" class="submit-button" :disabled="loading">
          {{ loading ? '로그인 중...' : '로그인' }}
        </button>

        <div class="auth-links">
          <NuxtLink to="/auth/forgot-password" class="forgot-link">
            비밀번호를 잊으셨나요?
          </NuxtLink>
          <NuxtLink to="/register-email" class="register-link">
            이메일로 회원가입
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

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthService } from '~/composables/useAuthService'
import { useRoute, useRouter } from 'vue-router'
import { useRuntimeConfig } from 'nuxt/app'
import { useHead } from '#imports'
import { useModal } from '~/composables/useModal'
import { useNavigation } from '~/composables/useNavigation'
import { useApi } from '~/composables/useApi'

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
const route = useRoute()
const router = useRouter()

onMounted(() => {
  const queryRedirect = String(route.query.redirect || '')
  if (queryRedirect) {
    setRedirectUrl(queryRedirect)
  }
})

const handleSubmit = async () => {
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
    await modal.alert({
      title: '로그인 실패',
      description: '이메일 또는 비밀번호를 확인해주세요.',
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
}

const handleKakaoLogin = () => {
  const redirectUri = encodeURIComponent(config.public.KAKAO_REDIRECT_URI)
  // scope: profile_nickname, profile_image, account_email 권한 요청
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${config.public.KAKAO_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=profile_nickname,profile_image,account_email`
  window.location.href = kakaoAuthUrl
}

const handleGoogleLogin = () => {
  const redirectUri = encodeURIComponent(config.public.GOOGLE_REDIRECT_URI)
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.public.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&access_type=offline&prompt=consent`
  window.location.href = googleAuthUrl
}

const handleAppleLogin = () => {
  const clientId = config.public.APPLE_CLIENT_ID
  const redirectUri = encodeURIComponent(config.public.APPLE_REDIRECT_URI || `${window.location.origin}/auth/apple/callback`)
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
  gap: 2rem;
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
  margin-bottom: 1rem;
}

.logo {
  height: 2rem;
  width: auto;
  object-fit: contain;
  margin: 0 auto;
  transition: filter 0.2s ease;
}

/* 다크모드에서 로고 반전 */
[data-theme="dark"] .logo {
  filter: brightness(0) invert(1);
}

.social-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.kakao-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background-color: #FEE500;
  color: #000000 !important;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.kakao-button:hover {
  background-color: #FDD835;
  transform: translateY(-1px);
}

.kakao-button:active {
  transform: translateY(0);
}

.google-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background-color: #FFFFFF;
  color: #1F2937;
  border: 1px solid var(--color-slate-300);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.google-button:hover {
  background-color: #F9FAFB;
  transform: translateY(-1px);
}

.google-button:active {
  transform: translateY(0);
}

[data-theme="dark"] .google-button {
  background-color: #FFFFFF;
  color: #1F2937;
  border-color: #E5E7EB;
}

[data-theme="dark"] .google-button:hover {
  background-color: #F9FAFB;
}

.apple-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background-color: #000000;
  color: #FFFFFF;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.apple-button:hover {
  background-color: #1a1a1a;
  transform: translateY(-1px);
}

.apple-button:active {
  transform: translateY(0);
}

.divider {
  position: relative;
  text-align: center;
  margin: 0.5rem 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background-color: var(--color-slate-300);
}

.divider span {
  position: relative;
  display: inline-block;
  padding: 0 0.5rem;
  background-color: var(--color-bg-base);
  color: var(--color-slate-500);
  font-size: 0.875rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.auth-links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.forgot-link {
  color: var(--color-slate-500);
  text-decoration: none;
  transition: color 0.2s ease;
}

.forgot-link:hover {
  color: var(--color-slate-700);
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
    gap: 1.5rem;
  }
}

/* Tablet: iPad Mini and similar */
@media (min-width: 768px) {
  .login-container {
    padding: 3rem 2rem;
  }

  .login-box {
    max-width: 480px;
    gap: 2rem;
    padding: 2.5rem;
  }

  .logo {
    width: 200px;
  }

  h1 {
    font-size: 1.75rem;
  }

  .social-buttons {
    gap: 1rem;
  }

  .social-button {
    font-size: 1rem;
    padding: 0.875rem;
  }
}

/* Tablet Large: iPad Pro and larger tablets */
@media (min-width: 1024px) {
  .login-container {
    padding: 4rem 3rem;
  }

  .login-box {
    max-width: 560px;
    gap: 2.5rem;
    padding: 3rem;
  }

  .logo {
    width: 240px;
  }

  h1 {
    font-size: 2rem;
  }

  .social-buttons {
    gap: 1.25rem;
  }

  .social-button {
    font-size: 1.125rem;
    padding: 1rem;
  }
}
</style>
