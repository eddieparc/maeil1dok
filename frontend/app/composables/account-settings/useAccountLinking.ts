/**
 * 계정 설정의 소셜 계정 연결/해제/병합 플로우.
 * pages/account/settings.vue 에 있던 로직을 그대로 옮긴 것이다.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useRuntimeConfig } from 'nuxt/app'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useModal } from '~/composables/useModal'
import {
  buildNativeAppleLinkRequest,
  buildOAuthLinkUrl,
  buildSocialMergePayload,
  getProviderDisplayName,
  parseNativeAppleLinkResult,
  shouldUseNativeAppleLink,
} from '~/utils/accountSettingsRuntime'
import { resolveSocialRedirectUri } from '#shared/utils/authCallbackRuntime'
import MergeAccountPicker from './MergeAccountPicker.vue'
import {
  getBoolean,
  getErrorMessage,
  getErrorPayload,
  normalizeLinkedAccounts,
  normalizeMergeInfo,
} from './normalize'
import type {
  KeepAccount,
  LinkedAccountsResponse,
  MergeInfo,
  NativeWindow,
  Provider,
} from './types'

const MERGE_PICKER_MODAL_ID = 'account-merge-picker'

export function useAccountLinking() {
  const api = useApi()
  const auth = useAuthService()
  const modal = useModal()
  const config = useRuntimeConfig()

  const loading = ref(true)
  const linkedAccounts = ref<LinkedAccountsResponse | null>(null)
  const linkingProvider = ref<Provider | null>(null)
  const mergeInfo = ref<MergeInfo | null>(null)
  const mergeLoading = ref(false)
  const showMergeModal = ref(false)
  let pendingNativeAppleState: string | null = null

  const isProviderLinked = (provider: Provider) =>
    linkedAccounts.value?.linked_accounts.some(account => account.provider === provider) ?? false

  const getLinkedAccount = (provider: Provider) =>
    linkedAccounts.value?.linked_accounts.find(account => account.provider === provider)

  const canUnlink = (provider: Provider) => {
    const account = getLinkedAccount(provider)
    return account?.can_unlink ?? false
  }

  const fetchLinkedAccounts = async () => {
    try {
      const response = await api.GET('/api/v1/auth/linked-accounts/')
      linkedAccounts.value = normalizeLinkedAccounts(response.data)
    } catch (error) {
      await modal.alert({
        title: '계정 정보를 불러오지 못했습니다',
        description: getErrorMessage(error, '잠시 후 다시 시도해주세요.'),
        icon: 'error'
      })
    } finally {
      loading.value = false
    }
  }

  const getOAuthLinkState = async () => {
    const response = await api.POST('/api/v1/auth/oauth/link-state/')
    const state = response.state
    if (typeof state !== 'string' || !state) {
      throw new Error('Invalid OAuth state')
    }
    const encodedState = encodeURIComponent(state)
    return decodeURIComponent(encodedState)
  }

  const getOAuthProviderConfig = (provider: Provider) => {
    const providerConfig = {
      kakao: {
        clientId: config.public.KAKAO_CLIENT_ID,
        redirectUri: resolveSocialRedirectUri(
          'kakao',
          config.public.KAKAO_REDIRECT_URI,
          window.location.origin,
        ),
        baseUrl: 'https://kauth.kakao.com/oauth/authorize',
      },
      google: {
        clientId: config.public.GOOGLE_CLIENT_ID,
        redirectUri: resolveSocialRedirectUri(
          'google',
          config.public.GOOGLE_REDIRECT_URI,
          window.location.origin,
        ),
        baseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        scope: 'email profile',
      },
      apple: {
        clientId: config.public.APPLE_CLIENT_ID,
        redirectUri: resolveSocialRedirectUri(
          'apple',
          config.public.APPLE_REDIRECT_URI,
          window.location.origin,
        ),
        baseUrl: 'https://appleid.apple.com/auth/authorize',
        scope: 'name email',
      },
    }
    return providerConfig[provider]
  }

  const handleLinkProvider = async (provider: Provider) => {
    if (linkingProvider.value) return

    const nativeWindow = window as NativeWindow
    const useNativeAppleLink = shouldUseNativeAppleLink(
      provider,
      nativeWindow.isReactNativeWebView === true,
    )
    if (!useNativeAppleLink) {
      const { clientId, redirectUri } = getOAuthProviderConfig(provider)
      if (!clientId || !redirectUri) {
        await modal.alert({
          title: '연결 설정이 필요합니다',
          description: `${getProviderDisplayName(provider)} 로그인 설정을 확인해주세요.`,
          icon: 'error',
        })
        return
      }
    }

    linkingProvider.value = provider
    try {
      const state = await getOAuthLinkState()
      if (useNativeAppleLink) {
        if (!nativeWindow.ReactNativeWebView) {
          throw new Error('Native Apple authentication bridge is unavailable.')
        }
        pendingNativeAppleState = state
        nativeWindow.ReactNativeWebView.postMessage(JSON.stringify(
          buildNativeAppleLinkRequest(state),
        ))
        return
      }
      const providerConfig = getOAuthProviderConfig(provider)
      const authUrl = buildOAuthLinkUrl(provider, providerConfig, state)
      window.location.assign(authUrl)
    } catch (error: unknown) {
      pendingNativeAppleState = null
      linkingProvider.value = null
      await modal.alert({
        title: '계정 연결 실패',
        description: getErrorMessage(error, '소셜 계정 연결을 시작하지 못했습니다.'),
        icon: 'error',
      })
    }
  }

  const completeNativeAppleLink = async (result: {
    state: string
    idToken: string
    code: string
  }) => {
    try {
      await api.POST('/api/v1/auth/link-social/', {
        provider: 'apple',
        code: result.code,
        state: result.state,
        id_token: result.idToken,
      })
      await fetchLinkedAccounts()
      await modal.alert({
        title: '연결 완료',
        description: 'Apple 계정이 연결되었습니다.',
        icon: 'success'
      })
    } catch (error: unknown) {
      const payload = getErrorPayload(error)
      if (payload && getBoolean(payload, 'can_merge')) {
        const normalized = normalizeMergeInfo({
          ...payload,
          provider: 'apple',
          code: result.code,
          id_token: result.idToken,
        })
        if (normalized) {
          beginMerge(normalized)
          return
        }
      }
      await modal.alert({
        title: '연결 실패',
        description: getErrorMessage(error, 'Apple 계정 연결에 실패했습니다.'),
        icon: 'error'
      })
    } finally {
      linkingProvider.value = null
    }
  }

  const handleNativeAppleLinkMessage = (event: MessageEvent<unknown>) => {
    let payload = event.data
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch {
        return
      }
    }
    const result = parseNativeAppleLinkResult(payload)
    if (!result || result.state !== pendingNativeAppleState) return
    pendingNativeAppleState = null
    if ('error' in result) {
      linkingProvider.value = null
      if (result.error !== 'cancelled') {
        void modal.alert({
          title: '연결 실패',
          description: 'Apple 시스템 로그인을 시작하지 못했습니다.',
          icon: 'error'
        })
      }
      return
    }
    void completeNativeAppleLink(result)
  }

  const handleUnlink = async (provider: Provider) => {
    const confirmed = await modal.confirm({
      title: '계정 연결 해제',
      description: `${getProviderDisplayName(provider)} 계정 연결을 해제하시겠습니까?`,
      confirmText: '해제',
      confirmVariant: 'danger'
    })

    if (!confirmed) return

    try {
      await api.POST('/api/v1/auth/unlink-social/', { provider })
      await modal.alert({
        title: '연결 해제 완료',
        description: '소셜 계정 연결이 해제되었습니다.',
        icon: 'success'
      })
      await fetchLinkedAccounts()
    } catch (error: unknown) {
      await modal.alert({
        title: '연결 해제 실패',
        description: getErrorMessage(error, '연결 해제에 실패했습니다.'),
        icon: 'error'
      })
    }
  }

  const handleMerge = async (keepAccount: KeepAccount) => {
    if (!mergeInfo.value) return
    const payload = buildSocialMergePayload(mergeInfo.value, keepAccount)

    mergeLoading.value = true
    try {
      const data = await api.POST('/api/v1/auth/merge-accounts/', payload)

      if (keepAccount === 'other' && data.access) {
        auth.setTokens(data.access, data.refresh)
        auth.setUser(data.user as Parameters<typeof auth.setUser>[0])
      }

      showMergeModal.value = false
      mergeInfo.value = null
      modal.close(MERGE_PICKER_MODAL_ID)

      await modal.alert({
        title: '계정 병합 완료',
        description: '계정이 병합되었습니다. 삭제될 계정은 30일 후 완전히 삭제됩니다.',
        icon: 'success'
      })

      await fetchLinkedAccounts()
    } catch (error: unknown) {
      // 실패 시 피커를 열어둬 재시도할 수 있게 한다 (기존 오버레이 동작과 동일).
      await modal.alert({
        title: '병합 실패',
        description: getErrorMessage(error, '계정 병합에 실패했습니다.'),
        icon: 'error'
      })
    } finally {
      mergeLoading.value = false
    }
  }

  const openMergePicker = async () => {
    if (!mergeInfo.value) return
    try {
      await modal.open(MergeAccountPicker, {
        id: MERGE_PICKER_MODAL_ID,
        size: 'lg',
        position: 'center',
        closeOnEsc: false,
        closeOnOverlay: false,
        showCloseButton: false,
        props: {
          mergeInfo: mergeInfo.value,
          onSelect: handleMerge,
        },
      })
    } catch {
      // 취소로 닫힌 경우는 무시한다.
    }
  }

  const beginMerge = (info: MergeInfo | null) => {
    mergeInfo.value = info
    showMergeModal.value = info !== null
  }

  onMounted(() => {
    window.addEventListener('message', handleNativeAppleLinkMessage)
  })

  onUnmounted(() => {
    window.removeEventListener('message', handleNativeAppleLinkMessage)
  })

  return {
    loading,
    linkedAccounts,
    linkingProvider,
    mergeInfo,
    mergeLoading,
    showMergeModal,
    isProviderLinked,
    canUnlink,
    fetchLinkedAccounts,
    handleLinkProvider,
    handleUnlink,
    openMergePicker,
    beginMerge,
  }
}
