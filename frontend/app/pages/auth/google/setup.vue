<template>
  <AuthSocialSignupForm v-model="nickname" provider="google" :error="nicknameError" :checked="isNicknameChecked" :checking="checkingNickname" :loading="loading" :suggestions="suggestions" @submit="handleSubmit" @retry="checkNickname">
    <p v-if="submitError" class="auth-error" role="alert">{{ submitError }}</p>
    <code v-if="submitCode" class="auth-code">code: {{ submitCode }}</code>
  </AuthSocialSignupForm>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AuthSocialSignupForm from '~/components/auth/AuthSocialSignupForm.vue'
import { useAuthNicknameField } from '~/composables/useAuthNicknameField'
import { authErrorCode, authNicknameSuggestions } from '~/utils/authFormUi'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { useModal } from '~/composables/useModal'
import { useNavigation } from '~/composables/useNavigation'
import { resolveSocialSignupError } from '~/utils/socialSignupError'

const route = useRoute()
const auth = useAuthService()
const api = useApi()
const modal = useModal()
const { consumeRedirectUrl } = useNavigation()
const nickname = ref('')
const profileImage = ref<string | null>(null)
const loading = ref(false)
const providerId = ref<string | null>(null)
const email = ref<string | null>(null)
const signupToken = ref<string | null>(null)
const suggestions = ref<string[]>([])
const submitError = ref('')
const submitCode = ref('')
const { nicknameError, isNicknameChecked, checkingNickname, checkNickname } = useAuthNicknameField(nickname)

onMounted(() => {
  const storedData = sessionStorage.getItem('social_signup_data')
  if (storedData) {
    try {
      const data = JSON.parse(storedData)
      providerId.value = data.provider_id || null
      nickname.value = data.suggested_nickname || ''
      profileImage.value = data.profile_image || null
      email.value = data.email || null
      signupToken.value = data.signup_token || null
    } catch {
      console.warn('Stored social signup data is invalid; using the route fallback.')
    } finally {
      sessionStorage.removeItem('social_signup_data')
    }
  }
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
  suggestions.value = authNicknameSuggestions(nickname.value)
})

const handleSubmit = async () => {
  if (loading.value || !isNicknameChecked.value || nicknameError.value || (!providerId.value && !signupToken.value) || !nickname.value) return
  loading.value = true
  submitError.value = ''
  submitCode.value = ''
  try {
    const response = await api.POST('/api/v1/auth/complete-social-signup/', {
      signup_token: signupToken.value,
      provider: 'google',
      provider_id: providerId.value,
      nickname: nickname.value,
      email: email.value,
      profile_image: profileImage.value
    })
    if (!response.access || !response.user) throw new Error('Invalid signup response')
    auth.setTokens(response.access, response.refresh)
    auth.setUser(response.user as Parameters<typeof auth.setUser>[0])
    if (window.__nativeBridge?.isNativeApp()) {
      window.__nativeBridge.sendToNative({ type: 'auth:login', data: { token: response.access, refreshToken: response.refresh, user: response.user as Parameters<typeof auth.setUser>[0] } })
    }
    const redirectUrl = consumeRedirectUrl() || '/'
    navigateTo(redirectUrl)
  } catch (error: unknown) {
    console.error('Signup failed:', error)
    const signupError = resolveSocialSignupError(error)
    submitError.value = signupError.message
    submitCode.value = authErrorCode(error)
    if (signupError.field === 'nickname') {
      nicknameError.value = signupError.message
      isNicknameChecked.value = false
    }
    await modal.alert({
      title: signupError.title, description: signupError.message, icon: 'warning', copyText: signupError.requestId,
      confirmText: signupError.action === 'restart_social_login' ? '소셜 로그인 다시 하기' : '확인',
    })
    if (signupError.action === 'restart_social_login') await navigateTo('/login')
  } finally {
    loading.value = false
  }
}
</script>
