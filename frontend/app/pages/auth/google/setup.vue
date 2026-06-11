<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Back Button -->
      <button 
        @click="$router.back()" 
        class="mb-8 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
      </button>

      <!-- Header -->
      <div>
        <NuxtImg
          class="mx-auto h-8 w-auto object-contain"
          src="/images/logo-transparent.png"
          alt="매일일독"
          loading="lazy"
          format="webp"
        />
        <p class="mt-3 text-center text-gray-600">
          매일일독에서 사용하실 닉네임을 입력해주세요
        </p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="mt-8 space-y-6">
        <div class="rounded-md shadow-sm">
          <div>
            <label for="nickname" class="sr-only">닉네임</label>
            <input
              id="nickname"
              v-model="nickname"
              type="text"
              required
              @input="checkNickname"
              class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
              :class="{
                'border-red-500 focus:ring-red-500 focus:border-red-500': nicknameError,
                'border-green-500 focus:ring-green-500 focus:border-green-500': isNicknameChecked && !nicknameError
              }"
              placeholder="2자 이상의 닉네임을 입력해주세요"
            >
            <div class="mt-2 min-h-[20px] flex items-center">
              <template v-if="nicknameError">
                <svg class="w-4 h-4 text-red-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <span class="text-red-500 text-sm">{{ nicknameError }}</span>
              </template>
              <template v-if="isNicknameChecked && !nicknameError">
                <svg class="w-4 h-4 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <span class="text-green-500 text-sm">사용 가능한 닉네임입니다</span>
              </template>
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-accent-primary hover:bg-accent-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-primary transition-all duration-200"
            :class="{'opacity-50 cursor-not-allowed': loading || !isNicknameChecked}"
            :disabled="loading || !isNicknameChecked"
          >
            <svg 
              v-if="loading" 
              class="animate-spin h-5 w-5 text-white mr-2" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ loading ? '처리 중...' : '시작하기' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { useNavigation } from '~/composables/useNavigation'

const route = useRoute()
const auth = useAuthService()
const api = useApi()
const { consumeRedirectUrl } = useNavigation()

const nickname = ref('')
const profileImage = ref<string | null>(null)
const loading = ref(false)
const providerId = ref<string | null>(null)
const email = ref<string | null>(null)
const signupToken = ref<string | null>(null)
const nicknameError = ref('')
const isNicknameChecked = ref(false)
let nicknameCheckTimeout: ReturnType<typeof setTimeout> | null = null

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

onMounted(() => {
  // sessionStorage에서 소셜 회원가입 데이터 읽기 (우선), 없으면 URL 쿼리 fallback
  const storedData = sessionStorage.getItem('social_signup_data')
  if (storedData) {
    try {
      const data = JSON.parse(storedData)
      providerId.value = data.provider_id || null
      nickname.value = data.suggested_nickname || ''
      profileImage.value = data.profile_image || null
      email.value = data.email || null
      signupToken.value = data.signup_token || null
      sessionStorage.removeItem('social_signup_data')
    } catch {
      sessionStorage.removeItem('social_signup_data')
    }
  }
  
  // sessionStorage에 데이터가 없는 경우 URL 쿼리에서 읽기 (앱 딥링크 등)
  if (!providerId.value) {
    providerId.value = route.query.provider_id as string || null
    nickname.value = route.query.suggested_nickname as string || ''
    profileImage.value = route.query.profile_image as string || null
    email.value = route.query.email as string || null
    signupToken.value = route.query.signup_token as string || null
  }

  if (!providerId.value && !signupToken.value) {
    navigateTo('/login')
    return
  }

  // SNS에서 전달된 닉네임이 있으면 자동 검증
  if (nickname.value.trim().length >= 2) {
    checkNickname()
  }
})

const handleSubmit = async () => {
  if ((!providerId.value && !signupToken.value) || !nickname.value) return

  loading.value = true
  try {
    const response = await api.post('/api/v1/auth/complete-social-signup/', {
      signup_token: signupToken.value,
      provider: 'google',
      provider_id: providerId.value,
      nickname: nickname.value,
      email: email.value,
      profile_image: profileImage.value
    })

    if (response.access) {
      auth.setTokens(response.access, response.refresh)
      auth.setUser(response.user)
      
      if (window.__nativeBridge?.isNativeApp()) {
        window.__nativeBridge.sendToNative({
          type: 'auth:login',
          data: {
            token: response.access,
            refreshToken: response.refresh,
            user: response.user
          }
        })
      }
      
      const redirectUrl = consumeRedirectUrl() || '/'
      navigateTo(redirectUrl)
    }
  } catch (error: any) {
    console.error('Signup failed:', error)
    alert(error.message || '회원가입에 실패했습니다. 다시 시도해주세요.')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
button:disabled {
  @apply opacity-70 cursor-not-allowed transform-none;
}

.btn-primary:not(:disabled):hover {
  @apply transform -translate-y-0.5;
}
</style>
