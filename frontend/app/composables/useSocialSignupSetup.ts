import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthNicknameField } from '~/composables/useAuthNicknameField'
import { authErrorCode, authNicknameSuggestions } from '~/utils/authFormUi'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { useModal } from '~/composables/useModal'
import { useNavigation } from '~/composables/useNavigation'
import { resolveSocialSignupError } from '~/utils/socialSignupError'

type SocialProvider = 'kakao' | 'google' | 'apple'

export const useSocialSignupSetup = (provider: SocialProvider) => {
  const route = useRoute()
  const auth = useAuthService()
  const api = useApi()
  const modal = useModal()
  const { consumeRedirectUrl } = useNavigation()

  const nickname = ref('')
  const profileImage = ref<string | null>(null)
  const providerId = ref<string | null>(null)
  const email = ref<string | null>(null)
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
        profileImage.value = typeof data.profile_image === 'string' ? data.profile_image : null
        email.value = typeof data.email === 'string' ? data.email : null
      } catch {
        console.warn('Stored social signup data is invalid; using the route fallback.')
      } finally {
        sessionStorage.removeItem('social_signup_data')
      }
    }
    if (!providerId.value) {
      providerId.value = route.query[`${provider}_id`] as string || route.query.provider_id as string || null
      // apple은 query에 suggested_nickname이 없으면 sessionStorage 값을 보존한다 (원본 페이지 동작).
      nickname.value = provider === 'apple'
        ? (typeof route.query.suggested_nickname === 'string' ? route.query.suggested_nickname : nickname.value)
        : (route.query.suggested_nickname as string || '')
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
    const nicknameEmpty = provider === 'apple' ? !nickname.value.trim() : !nickname.value
    if (loading.value || !isNicknameChecked.value || nicknameError.value || (!providerId.value && !signupToken.value) || nicknameEmpty) return
    loading.value = true
    submitError.value = ''
    submitCode.value = ''
    try {
      const body: Record<string, unknown> = {
        signup_token: signupToken.value,
        provider,
        provider_id: providerId.value,
        nickname: provider === 'apple' ? nickname.value.trim() : nickname.value,
      }
      if (provider !== 'apple') {
        body.profile_image = profileImage.value
        body.email = email.value
      }
      const response = await api.POST('/api/v1/auth/complete-social-signup/', body)
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

  return {
    nickname,
    profileImage,
    providerId,
    email,
    signupToken,
    loading,
    suggestions,
    submitError,
    submitCode,
    nicknameError,
    isNicknameChecked,
    checkingNickname,
    checkNickname,
    handleSubmit,
  }
}
