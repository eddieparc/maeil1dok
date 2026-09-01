<template>
  <div class="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-md space-y-8">
      <button
        type="button"
        class="mb-8 flex items-center text-gray-600 transition-colors hover:text-gray-900"
        @click="$router.back()"
      >
        <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        이전
      </button>

      <div>
        <NuxtImg
          class="mx-auto h-8 w-auto object-contain"
          src="/images/logo-transparent.png"
          alt="매일일독"
          loading="eager"
          format="webp"
        />
        <h1 class="mt-6 text-center text-xl font-semibold text-gray-900">
          Apple 계정으로 시작하기
        </h1>
        <p class="mt-3 text-center text-gray-600">
          매일일독에서 사용하실 닉네임을 입력해 주세요.
        </p>
      </div>

      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div>
          <label for="nickname" class="sr-only">닉네임</label>
          <input
            id="nickname"
            v-model="nickname"
            type="text"
            required
            autocomplete="nickname"
            class="relative block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            :class="{
              'border-red-500 focus:border-red-500 focus:ring-red-500': nicknameError,
              'border-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]': isNicknameChecked && !nicknameError,
            }"
            :aria-invalid="Boolean(nicknameError)"
            aria-describedby="apple-nickname-status"
            placeholder="2자 이상의 닉네임을 입력해 주세요"
            @input="checkNickname"
          >
          <div
            id="apple-nickname-status"
            class="mt-2 min-h-5"
            aria-live="polite"
          >
            <p v-if="nicknameError" class="text-sm text-red-500">
              {{ nicknameError }}
            </p>
            <p
              v-else-if="isNicknameChecked"
              class="text-sm text-[var(--color-accent-primary)]"
            >
              사용 가능한 닉네임입니다.
            </p>
          </div>
        </div>

        <button
          type="submit"
          class="flex w-full justify-center rounded-md border border-transparent bg-accent-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-accent-primary-hover focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loading || !isNicknameChecked"
        >
          {{ loading ? '가입 처리 중...' : '시작하기' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useModal } from '~/composables/useModal'
import { useNavigation } from '~/composables/useNavigation'
import { resolveSocialSignupError } from '~/utils/socialSignupError'

const route = useRoute()
const api = useApi()
const auth = useAuthService()
const modal = useModal()
const { consumeRedirectUrl } = useNavigation()

const nickname = ref('')
const providerId = ref<string | null>(null)
const signupToken = ref<string | null>(null)
const loading = ref(false)
const nicknameError = ref('')
const isNicknameChecked = ref(false)
let nicknameCheckGeneration = 0

const checkNickname = async () => {
  const generation = ++nicknameCheckGeneration
  const value = nickname.value.trim()
  nicknameError.value = ''
  isNicknameChecked.value = false

  if (value.length < 2) {
    nicknameError.value = '닉네임은 2자 이상이어야 합니다.'
    return
  }
  if (value.length > 20) {
    nicknameError.value = '닉네임은 20자 이하여야 합니다.'
    return
  }

  try {
    const response = await api.POST('/api/v1/auth/check-nickname/', {
      nickname: value,
    })
    if (generation !== nicknameCheckGeneration) return
    if (response.available) {
      isNicknameChecked.value = true
    } else {
      nicknameError.value = '이미 사용 중인 닉네임입니다.'
    }
  } catch {
    if (generation === nicknameCheckGeneration) {
      nicknameError.value = '닉네임 사용 가능 여부를 확인하지 못했습니다.'
    }
  }
}

onMounted(() => {
  const storedData = sessionStorage.getItem('social_signup_data')
  if (storedData) {
    try {
      const data = JSON.parse(storedData) as Record<string, unknown>
      providerId.value = typeof data.provider_id === 'string' ? data.provider_id : null
      signupToken.value = typeof data.signup_token === 'string' ? data.signup_token : null
      nickname.value = typeof data.suggested_nickname === 'string'
        ? data.suggested_nickname
        : ''
    } finally {
      sessionStorage.removeItem('social_signup_data')
    }
  }

  if (!providerId.value) {
    providerId.value = typeof route.query.provider_id === 'string'
      ? route.query.provider_id
      : null
    signupToken.value = typeof route.query.signup_token === 'string'
      ? route.query.signup_token
      : null
    nickname.value = typeof route.query.suggested_nickname === 'string'
      ? route.query.suggested_nickname
      : nickname.value
  }

  if (!providerId.value && !signupToken.value) {
    navigateTo('/login')
    return
  }
  if (nickname.value.trim().length >= 2) {
    checkNickname()
  }
})

const handleSubmit = async () => {
  if ((!providerId.value && !signupToken.value) || !nickname.value.trim()) return

  loading.value = true
  try {
    const response = await api.POST('/api/v1/auth/complete-social-signup/', {
      signup_token: signupToken.value,
      provider: 'apple',
      provider_id: providerId.value,
      nickname: nickname.value.trim(),
    })
    if (!response.access || !response.user) return

    auth.setTokens(response.access, response.refresh)
    auth.setUser(response.user as Parameters<typeof auth.setUser>[0])
    if (window.__nativeBridge?.isNativeApp()) {
      window.__nativeBridge.sendToNative({
        type: 'auth:login',
        data: {
          token: response.access,
          refreshToken: response.refresh,
          user: response.user as Parameters<typeof auth.setUser>[0],
        },
      })
    }
    await navigateTo(consumeRedirectUrl() || '/')
  } catch (error: unknown) {
    const signupError = resolveSocialSignupError(error)
    if (signupError.field === 'nickname') {
      nicknameError.value = signupError.message
      isNicknameChecked.value = false
    }
    await modal.alert({
      title: signupError.title,
      description: signupError.message,
      icon: 'warning',
      copyText: signupError.requestId,
      confirmText: signupError.action === 'restart_social_login'
        ? 'Apple 로그인 다시 하기'
        : '확인',
    })
    if (signupError.action === 'restart_social_login') {
      await navigateTo('/login')
    }
  } finally {
    loading.value = false
  }
}
</script>
