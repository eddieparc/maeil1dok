<!-- noqa: SIZE_OK OAuth callback is the existing provider bridge; this hardening keeps the redirect contract intact -->
<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <p>{{ statusMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNavigation } from '~/composables/useNavigation'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import {
  buildLinkSocialPayload,
  firstQueryValue,
  getMergeToken,
  getNativeAppScheme,
  isSignedLinkState,
  type NativeAppState,
} from '#shared/utils/authCallbackRuntime'

const route = useRoute()
const auth = useAuthService()
const { consumeRedirectUrl } = useNavigation()

const statusMessage = ref('처리 중입니다...')

const parseStateParam = (): NativeAppState | null => {
  const state = firstQueryValue(route.query.state)
  if (!state) return null
  try {
    return JSON.parse(decodeURIComponent(state)) as NativeAppState
  } catch {
    return null
  }
}

const redirectToApp = (scheme: string, provider: string, params: Record<string, string>) => {
  const queryString = new URLSearchParams(params).toString()
  const deepLink = `${scheme}://auth/${provider}/callback?${queryString}`
  window.location.href = deepLink
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getString = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

const getErrorData = (error: unknown) => {
  if (!isRecord(error)) return {}
  const data = error.data
  if (isRecord(data)) return data
  const response = error.response
  if (isRecord(response) && isRecord(response.data)) return response.data
  return {}
}

onMounted(async () => {
  const { provider } = route.params
  const providerName = firstQueryValue(provider)
  const code = firstQueryValue(route.query.code)
  const state = firstQueryValue(route.query.state)
  const stateData = parseStateParam()
  const safeAppScheme = getNativeAppScheme(stateData)
  const isFromApp = Boolean(safeAppScheme)
  const isLinkAction = isSignedLinkState(state)

  if (!code) {
    navigateTo('/login')
    return
  }

  // 계정 연결 (로그인된 상태에서 다른 소셜 계정 연결)
  // OAuth 리다이렉트 후 페이지가 새로 로드되므로 auth 초기화 필요
  if (isLinkAction) {
    statusMessage.value = '인증 확인 중입니다...'
    await auth.initializeAuth()
    
    if (!auth.isAuthenticated.value) {
      navigateTo({
        path: '/account/settings',
        query: { linked: 'error', message: '로그인이 필요합니다' }
      })
      return
    }
    
    statusMessage.value = '계정 연결 중입니다...'
    await handleLinkSocialAccount(providerName, code, state)
    return
  }

  statusMessage.value = '로그인 처리 중입니다...'
  if (providerName === 'kakao') {
    await handleKakaoCallback(code, isFromApp, safeAppScheme)
  } else if (providerName === 'google') {
    await handleGoogleCallback(code, isFromApp, safeAppScheme)
  } else if (providerName === 'apple') {
    const idToken = firstQueryValue(route.query.id_token)
    const userInfo = firstQueryValue(route.query.user)
    await handleAppleCallback(code, idToken, userInfo, isFromApp, safeAppScheme)
  } else {
    navigateTo('/login')
  }
})

// 계정 연결 처리
const handleLinkSocialAccount = async (provider: string, code: string, state: string) => {
  const idToken = firstQueryValue(route.query.id_token)
  try {
    const api = useApi()
    
    const payload = buildLinkSocialPayload(provider, code, state, idToken)
    
    const response = await api.POST('/api/v1/auth/link-social/', payload)

    navigateTo({
      path: '/account/settings',
      query: { linked: 'success', provider }
    })
  } catch (error: unknown) {
    const errorData = getErrorData(error)
    
    if (errorData.can_merge) {
      sessionStorage.setItem('merge_info', JSON.stringify({
        provider,
        code,
        id_token: idToken || undefined,
        merge_token: getMergeToken(errorData),
        current_account: errorData.current_account,
        other_account: errorData.other_account
      }))
      
      navigateTo({
        path: '/account/settings',
        query: { action: 'merge' }
      })
      return
    }

    console.error('[Link Social] Error:', error)
    navigateTo({
      path: '/account/settings',
      query: { linked: 'error', message: getString(errorData, 'error') || '연결 실패' }
    })
  }
}

const handleKakaoCallback = async (code: string, isFromApp = false, appScheme?: string) => {
  try {
    const response = await auth.socialLogin('kakao', code)

    if (response.needsSignup) {
      if (isFromApp && appScheme) {
        redirectToApp(appScheme, 'kakao', {
          needsSignup: 'true',
          provider: 'kakao',
          provider_id: response.kakao_id || '',
          email: response.email || '',
          suggested_nickname: response.suggested_nickname || '',
          profile_image: response.profile_image || '',
          signup_token: response.signup_token || ''
        })
      } else {
        // sessionStorage에 signup 데이터 저장 (보안: URL에 토큰 노출 방지)
        sessionStorage.setItem('social_signup_data', JSON.stringify({
          provider: 'kakao',
          provider_id: response.kakao_id || '',
          email: response.email || '',
          suggested_nickname: response.suggested_nickname || '',
          profile_image: response.profile_image || '',
          signup_token: response.signup_token || ''
        }))
        navigateTo({
          path: '/auth/kakao/setup'
        })
      }
    } else {
      if (isFromApp && appScheme) {
        redirectToApp(appScheme, 'kakao', {
          access: response.access,
          refresh: response.refresh,
          user: encodeURIComponent(JSON.stringify(response.user))
        })
      } else {
        if (response.access) {
          auth.setTokens(response.access, response.refresh)
          auth.setUser(response.user)
        }
        const redirectUrl = consumeRedirectUrl() || '/'
        navigateTo(redirectUrl)
      }
    }
  } catch (error) {
    console.error('[Kakao Callback] Error during login:', error)
    if (isFromApp && appScheme) {
      redirectToApp(appScheme, 'kakao', { error: 'login_failed' })
    } else {
      navigateTo('/login')
    }
  }
}

const handleGoogleCallback = async (code: string, isFromApp = false, appScheme?: string) => {
  try {
    const api = useApi()
    const response = await api.POST('/api/v1/auth/social-login/v2/', {
      provider: 'google',
      code
    })

    const data = response

    if ('needsSignup' in data && data.needsSignup) {
      if (isFromApp && appScheme) {
        redirectToApp(appScheme, 'google', {
          needsSignup: 'true',
          provider: 'google',
          provider_id: data.provider_id as string,
          email: data.email || '',
          suggested_nickname: data.suggested_nickname || '',
          profile_image: data.profile_image || '',
          signup_token: data.signup_token || ''
        })
      } else {
        // sessionStorage에 signup 데이터 저장 (보안: URL에 토큰 노출 방지)
        sessionStorage.setItem('social_signup_data', JSON.stringify({
          provider: 'google',
          provider_id: data.provider_id,
          email: data.email || '',
          suggested_nickname: data.suggested_nickname || '',
          profile_image: data.profile_image || '',
          signup_token: data.signup_token || ''
        }))
        navigateTo({
          path: '/auth/google/setup'
        })
      }
    } else {
      const loginData = data as Extract<typeof data, { access: string }>
      if (isFromApp && appScheme) {
        redirectToApp(appScheme, 'google', {
          access: loginData.access,
          refresh: loginData.refresh,
          user: encodeURIComponent(JSON.stringify(loginData.user))
        })
      } else {
        if (loginData.access) {
          auth.setTokens(loginData.access, loginData.refresh)
          auth.setUser(loginData.user as Parameters<typeof auth.setUser>[0])
        }
        const redirectUrl = consumeRedirectUrl() || '/'
        navigateTo(redirectUrl)
      }
    }
  } catch (error) {
    console.error('[Google Callback] Error during login:', error)
    if (isFromApp && appScheme) {
      redirectToApp(appScheme, 'google', { error: 'login_failed' })
    } else {
      navigateTo('/login')
    }
  }
}

const handleAppleCallback = async (code: string, idToken: string, userInfo: string | undefined, isFromApp = false, appScheme?: string) => {
  try {
    const api = useApi()
    
    // Parse user info if provided (Apple only sends this on first login)
    let fullName: string | undefined
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo)
        if (user.name) {
          fullName = `${user.name.firstName || ''} ${user.name.lastName || ''}`.trim() || undefined
        }
      } catch {
        // Ignore parse errors
      }
    }
    
    const response = await api.POST('/api/v1/auth/social-login/v2/', {
      provider: 'apple',
      code,
      id_token: idToken,
      full_name: fullName
    })

    const data = response

    if ('needsSignup' in data && data.needsSignup) {
      if (isFromApp && appScheme) {
        redirectToApp(appScheme, 'apple', {
          needsSignup: 'true',
          provider: 'apple',
          provider_id: data.provider_id as string,
          email: data.email || '',
          suggested_nickname: data.suggested_nickname || '',
          profile_image: data.profile_image || '',
          signup_token: data.signup_token || ''
        })
      } else {
        // sessionStorage에 signup 데이터 저장 (보안: URL에 토큰 노출 방지)
        sessionStorage.setItem('social_signup_data', JSON.stringify({
          provider: 'apple',
          provider_id: data.provider_id,
          email: data.email || '',
          suggested_nickname: data.suggested_nickname || '',
          profile_image: data.profile_image || '',
          signup_token: data.signup_token || ''
        }))
        navigateTo({
          path: '/auth/apple/setup'
        })
      }
    } else {
      const loginData = data as Extract<typeof data, { access: string }>
      if (isFromApp && appScheme) {
        redirectToApp(appScheme, 'apple', {
          access: loginData.access,
          refresh: loginData.refresh,
          user: encodeURIComponent(JSON.stringify(loginData.user))
        })
      } else {
        if (loginData.access) {
          auth.setTokens(loginData.access, loginData.refresh)
          auth.setUser(loginData.user as Parameters<typeof auth.setUser>[0])
        }
        const redirectUrl = consumeRedirectUrl() || '/'
        navigateTo(redirectUrl)
      }
    }
  } catch (error) {
    console.error('[Apple Callback] Error during login:', error)
    if (isFromApp && appScheme) {
      redirectToApp(appScheme, 'apple', { error: 'login_failed' })
    } else {
      navigateTo('/login')
    }
  }
}
</script>
