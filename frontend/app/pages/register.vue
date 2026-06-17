<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Back Button -->
      <button @click="handleBack"
        class="mb-8 flex items-center text-gray-600 hover:text-gray-900 transition-colors">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>

      <div>
        <NuxtImg
          class="mx-auto h-8 w-auto object-contain"
          src="/images/logo-transparent.png"
          alt="매일일독"
          loading="eager"
          format="webp"
        />
      </div>
      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div class="rounded-md shadow-sm space-y-4">
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700">아이디</label>
            <div class="relative">
              <input id="username" v-model="formData.username" type="text" required @blur="checkUsername"
                autocomplete="username"
                class="flex-1 mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                :class="{ 'border-red-500': usernameError, 'border-green-500': isUsernameChecked }">
              <span v-if="usernameError" class="text-red-500 text-xs mt-1">{{ usernameError }}</span>
              <span v-if="isUsernameChecked && !usernameError" class="text-green-500 text-xs mt-1">사용 가능한 아이디입니다.</span>
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">비밀번호</label>
            <input id="password" v-model="formData.password" type="password" required
              autocomplete="new-password"
              class="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
          </div>
        </div>

        <div>
          <label for="nickname" class="block text-sm font-medium text-gray-700">닉네임</label>
          <div class="relative">
            <input id="nickname" v-model="formData.nickname" type="text" required @blur="checkNickname"
              autocomplete="nickname"
              class="flex-1 mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              :class="{ 'border-red-500': nicknameError, 'border-green-500': isNicknameChecked }">
            <span v-if="nicknameError" class="text-red-500 text-xs mt-1">{{ nicknameError }}</span>
            <span v-if="isNicknameChecked && !nicknameError" class="text-green-500 text-xs mt-1">사용 가능한 닉네임입니다.</span>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <button type="submit" class="submit-button" :disabled="loading || !isUsernameChecked || !isNicknameChecked">
            {{ loading ? '가입 중...' : '가입하기' }}
          </button>

          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-gray-50 text-gray-500">간편 로그인</span>
            </div>
          </div>

          <div class="flex gap-4 justify-center">
            <button type="button" @click="handleKakaoLogin" class="social-button kakao-button">
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
          </div>
        </div>

        <div class="text-sm text-center">
          <NuxtLink to="/login" class="login-link">
            이미 계정이 있으신가요? 로그인하기
          </NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { useRuntimeConfig } from 'nuxt/app'
import { useHead } from '#imports'
import { useModal } from '~/composables/useModal'
import { useNavigation } from '~/composables/useNavigation'

const { goBack } = useNavigation()
const handleBack = () => goBack('/login')

useHead({
  title: '회원가입 - 매일일독',
  meta: [
    { name: 'description', content: '매일일독에 가입하여 성경 통독을 시작하세요. 간편한 카카오 로그인을 지원합니다.' },
    { property: 'og:title', content: '회원가입 - 매일일독' },
    { property: 'og:description', content: '매일일독에 가입하여 성경 통독을 시작하세요.' },
    { property: 'og:url', content: 'https://maeil1dok.app/register' },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'ko_KR' },
    { property: 'og:site_name', content: '매일일독' },
  ],
  link: [
    { rel: 'canonical', href: 'https://maeil1dok.app/register' },
  ],
})

const config = useRuntimeConfig()

const auth = useAuthService()
const api = useApi()
const modal = useModal()
const loading = ref(false)
const isUsernameChecked = ref(false)
const isNicknameChecked = ref(false)
const usernameError = ref('')
const nicknameError = ref('')

const formData = ref({
  username: '',
  nickname: '',
  password: ''
})

const checkUsername = async () => {
  if (!formData.value.username) return

  try {
    const response = await api.post('/api/v1/auth/check-username/', {
      username: formData.value.username
    })

    if (response.available) {
      isUsernameChecked.value = true
      usernameError.value = ''
    } else {
      isUsernameChecked.value = false
      usernameError.value = '이미 사용중인 아이디입니다.'
    }
  } catch (error) {
    isUsernameChecked.value = false
    usernameError.value = '중복 확인 중 오류가 발생했습니다.'
  }
}

const checkNickname = async () => {
  if (!formData.value.nickname) return

  try {
    const response = await api.post('/api/v1/auth/check-nickname/', {
      nickname: formData.value.nickname
    })

    if (response.available) {
      isNicknameChecked.value = true
      nicknameError.value = ''
    } else {
      isNicknameChecked.value = false
      nicknameError.value = '이미 사용중인 닉네임입니다.'
    }
  } catch (error) {
    isNicknameChecked.value = false
    nicknameError.value = '중복 확인 중 오류가 발생했습니다.'
  }
}

const handleSubmit = async () => {
  if (!isUsernameChecked.value || !isNicknameChecked.value) {
    await modal.alert({
      title: '확인 필요',
      description: '아이디와 닉네임 중복 확인이 필요합니다.',
      icon: 'warning'
    })
    return
  }

  loading.value = true
  try {
    const success = await auth.register(formData.value)
    if (success) {
      await modal.alert({
        title: '회원가입 완료',
        description: '회원가입이 완료되었습니다.',
        icon: 'success'
      })
      navigateTo('/login')
    }
  } finally {
    loading.value = false
  }
}

const handleKakaoLogin = () => {
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${config.public.KAKAO_CLIENT_ID}&redirect_uri=${config.public.KAKAO_REDIRECT_URI}&response_type=code`
  window.location.href = kakaoAuthUrl
}

const handleGoogleLogin = () => {
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.public.GOOGLE_CLIENT_ID}&redirect_uri=${config.public.GOOGLE_REDIRECT_URI}&response_type=code&scope=profile`
  window.location.href = googleAuthUrl
}

// 입력값이 변경되면 중복확인 상태 초기화
watch(() => formData.value.username, () => {
  isUsernameChecked.value = false
  usernameError.value = ''
})

watch(() => formData.value.nickname, () => {
  isNicknameChecked.value = false
  nicknameError.value = ''
})
</script>

<style scoped>
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
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.submit-button:hover {
  background-color: var(--primary-dark);
  transform: translateY(-1px);
}

.submit-button:active {
  transform: translateY(0);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-link {
  display: inline-block;
  margin-top: 1rem;
  color: var(--primary-color);
  font-weight: 500;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.login-link:hover {
  background-color: var(--primary-light);
  color: var(--primary-dark);
}

.social-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.kakao-button {
  background-color: #FEE500;
  color: #000000 !important;
  border: none;
}

.kakao-button:hover {
  background-color: #FDD835;
  transform: translateY(-1px);
}

.kakao-button:active {
  transform: translateY(0);
}

/* Tablet: iPad Mini and similar */
@media (min-width: 768px) {
  .register-form {
    max-width: 480px;
    padding: 2.5rem;
  }

  h1 {
    font-size: 1.75rem;
  }

  .kakao-button {
    font-size: 1rem;
    padding: 0.875rem;
  }
}

/* Tablet Large: iPad Pro and larger tablets */
@media (min-width: 1024px) {
  .register-form {
    max-width: 560px;
    padding: 3rem;
  }

  h1 {
    font-size: 2rem;
  }

  .kakao-button {
    font-size: 1.125rem;
    padding: 1rem;
  }
}
</style>
