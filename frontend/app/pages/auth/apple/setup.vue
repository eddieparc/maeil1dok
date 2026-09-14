<template>
  <AuthSocialSignupForm v-model="nickname" provider="apple" :error="nicknameError" :checked="isNicknameChecked" :checking="checkingNickname" :loading="loading" :suggestions="suggestions" @submit="handleSubmit" @retry="checkNickname">
    <p v-if="submitError" class="auth-error" role="alert">{{ submitError }}</p>
    <code v-if="submitCode" class="auth-code">code: {{ submitCode }}</code>
  </AuthSocialSignupForm>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AuthSocialSignupForm from '~/components/auth/AuthSocialSignupForm.vue'
import { useAuthNicknameField } from '~/composables/useAuthNicknameField'
import { authErrorCode, authNicknameSuggestions } from '~/utils/authFormUi'
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
const suggestions = ref<string[]>([])
const submitError = ref('')
const submitCode = ref('')
const { nicknameError, isNicknameChecked, checkingNickname, checkNickname } = useAuthNicknameField(nickname)

onMounted(() => {
  const storedData = sessionStorage.getItem('social_signup_data')
  if (storedData) {
    try {
      const data = JSON.parse(storedData) as Record<string, unknown>
      providerId.value = typeof data.provider_id === 'string' ? data.provider_id : null
      signupToken.value = typeof data.signup_token === 'string' ? data.signup_token : null
      nickname.value = typeof data.suggested_nickname === 'string' ? data.suggested_nickname : ''
    } catch {
      console.warn('Stored social signup data is invalid; using the route fallback.')
    } finally {
      sessionStorage.removeItem('social_signup_data')
    }
  }
  if (!providerId.value) {
    providerId.value = typeof route.query.provider_id === 'string' ? route.query.provider_id : null
    signupToken.value = typeof route.query.signup_token === 'string' ? route.query.signup_token : null
    nickname.value = typeof route.query.suggested_nickname === 'string' ? route.query.suggested_nickname : nickname.value
  }
  if (!providerId.value && !signupToken.value) {
    navigateTo('/login')
    return
  }
  suggestions.value = authNicknameSuggestions(nickname.value)
})

const handleSubmit = async () => {
  if (loading.value || !isNicknameChecked.value || nicknameError.value || (!providerId.value && !signupToken.value) || !nickname.value.trim()) return
  loading.value = true
  submitError.value = ''
  submitCode.value = ''
  try {
    const response = await api.POST('/api/v1/auth/complete-social-signup/', {
      signup_token: signupToken.value,
      provider: 'apple',
      provider_id: providerId.value,
      nickname: nickname.value.trim(),
    })
    if (!response.access || !response.user) throw new Error('Invalid signup response')
    auth.setTokens(response.access, response.refresh)
    auth.setUser(response.user as Parameters<typeof auth.setUser>[0])
    if (window.__nativeBridge?.isNativeApp()) {
      window.__nativeBridge.sendToNative({ type: 'auth:login', data: { token: response.access, refreshToken: response.refresh, user: response.user as Parameters<typeof auth.setUser>[0] } })
    }
    await navigateTo(consumeRedirectUrl() || '/')
  } catch (error: unknown) {
    const signupError = resolveSocialSignupError(error)
    submitError.value = signupError.message
    submitCode.value = authErrorCode(error)
    if (signupError.field === 'nickname') {
      nicknameError.value = signupError.message
      isNicknameChecked.value = false
    }
    await modal.alert({
      title: signupError.title, description: signupError.message, icon: 'warning', copyText: signupError.requestId,
      confirmText: signupError.action === 'restart_social_login' ? 'Apple 로그인 다시 하기' : '확인',
    })
    if (signupError.action === 'restart_social_login') await navigateTo('/login')
  } finally {
    loading.value = false
  }
}
</script>
