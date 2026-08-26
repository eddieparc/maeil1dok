<template>
  <div class="forgot-container">
    <div class="forgot-box">
      <button @click="goBack" class="back-btn">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>

      <div class="logo-container">
        <NuxtImg
          src="/images/logo-transparent.png"
          alt="매일일독"
          class="logo"
          loading="eager"
          format="webp"
        />
      </div>

      <div v-if="!submitted" class="form-container">
        <h2 class="title">비밀번호 재설정</h2>
        <p class="description">
          가입할 때 사용한 이메일을 입력하시면<br>
          비밀번호 재설정 링크를 보내드립니다.
        </p>

        <form @submit.prevent="handleSubmit" class="forgot-form">
          <div class="input-group">
            <label for="email" class="visually-hidden">이메일</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="form-input"
              placeholder="이메일"
            >
          </div>

          <button type="submit" class="submit-button" :disabled="loading">
            {{ loading ? '전송 중...' : '재설정 링크 보내기' }}
          </button>
        </form>

        <div class="login-section">
          <NuxtLink to="/login" class="login-link">
            로그인으로 돌아가기
          </NuxtLink>
        </div>
      </div>

      <div v-else class="success-container">
        <svg class="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h2 class="success-title">이메일을 확인해주세요</h2>
        <p class="success-text">
          {{ email }}로 비밀번호 재설정 링크를 보냈습니다.<br>
          이메일을 확인하여 비밀번호를 재설정해주세요.
        </p>
        <p class="note-text">
          이메일이 도착하지 않았다면 스팸 폴더를 확인해주세요.
        </p>
        <button @click="goToLogin" class="action-button">
          로그인으로 이동
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useModal } from '~/composables/useModal'
import { useNavigation } from '~/composables/useNavigation'
import { useHead } from '#imports'

useHead({
  title: '비밀번호 재설정 - 매일일독',
  meta: [
    { name: 'robots', content: 'noindex' }
  ]
})

const router = useRouter()
const api = useApi()
const modal = useModal()
const { goBack: navGoBack } = useNavigation()

const email = ref('')
const loading = ref(false)
const submitted = ref(false)

const handleSubmit = async () => {
  loading.value = true
  try {
    await api.POST('/api/v1/auth/request-password-reset/', { email: email.value })
    submitted.value = true
  } catch (error) {
    await modal.alert({
      title: '오류',
      description: '요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  navGoBack('/login')
}

const goToLogin = () => {
  router.push('/login')
}
</script>

<style scoped>
.forgot-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-base);
  padding: 3rem 1rem;
}

.forgot-box {
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
}

[data-theme="dark"] .logo {
  filter: brightness(0) invert(1);
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
  line-height: 1.6;
  margin: 0;
}

.forgot-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.input-group {
  display: flex;
  flex-direction: column;
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
}

.submit-button:hover:not(:disabled) {
  background-color: var(--primary-dark);
  transform: translateY(-1px);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-section {
  text-align: center;
}

.login-link {
  color: var(--color-slate-600);
  font-size: 0.875rem;
  text-decoration: none;
  transition: color 0.2s ease;
}

.login-link:hover {
  color: var(--primary-color);
}

.success-container {
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

.success-icon {
  width: 4rem;
  height: 4rem;
  color: var(--primary-color);
}

.success-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-slate-800);
  margin: 0;
}

.success-text {
  font-size: 0.875rem;
  color: var(--color-slate-600);
  margin: 0;
  line-height: 1.6;
}

.note-text {
  font-size: 0.75rem;
  color: var(--color-slate-500);
  margin: 0;
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
  margin-top: 0.5rem;
}

.action-button:hover {
  background-color: var(--primary-dark);
  transform: translateY(-1px);
}
</style>
