import type { AuthCredentials, NativeToWebViewEvent, WebViewToNativeMessage } from '~/types/native-bridge'
import { watch } from 'vue'
import { useAuthService } from '~/composables/useAuthService'
import { syncNativePushRegistration } from '~/utils/nativePushRuntime'

type AuthCallback = (credentials: AuthCredentials) => void
type LogoutCallback = () => void

declare global {
  interface Window {
    isReactNativeWebView?: boolean
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
    
    __nativeBridge?: {
      sendToNative: (message: WebViewToNativeMessage) => void
      isNativeApp: () => boolean
      registerAuthCallback: (onAuth: AuthCallback, onLogout: LogoutCallback) => void
    }
  }
}

let authCallback: AuthCallback | null = null
let logoutCallback: LogoutCallback | null = null

const ADSENSE_CLIENT_ID = 'ca-pub-8742107706365412'

function loadAdSense() {
  if (document.querySelector('script[src*="adsbygoogle"]')) {
    return
  }
  
  const script = document.createElement('script')
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`
  script.async = true
  script.crossOrigin = 'anonymous'
  document.head.appendChild(script)
}

function isExternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url, window.location.origin)
    return urlObj.origin !== window.location.origin
  } catch {
    return false
  }
}

function sendToNative(message: WebViewToNativeMessage): void {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message))
  }
}

function isNativeApp(): boolean {
  return window.isReactNativeWebView === true
}

function setupExternalLinkHandler() {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const anchor = target.closest('a')
    
    if (!anchor) return
    
    const href = anchor.getAttribute('href')
    if (!href) return
    
    if (!isExternalUrl(href)) return
    
    event.preventDefault()
    event.stopPropagation()
    
    sendToNative({ type: 'navigate', url: href })
  }, true)
}

function registerAuthCallback(onAuth: AuthCallback, onLogout: LogoutCallback) {
  authCallback = onAuth
  logoutCallback = onLogout
}

function setupNativeAuthListener() {
  window.addEventListener('native:auth', ((event: CustomEvent<NativeToWebViewEvent>) => {
    const { type } = event.detail
    
    if (type === 'token' && 'data' in event.detail) {
      authCallback?.(event.detail.data)
    } else if (type === 'logout') {
      logoutCallback?.()
    }
  }) as EventListener)
}

export default defineNuxtPlugin({
  name: 'native-app',
  parallel: false,
  setup(nuxtApp) {
    if (typeof window === 'undefined') return
    
    window.__nativeBridge = {
      sendToNative,
      isNativeApp,
      registerAuthCallback,
    }
    
    if (isNativeApp()) {
      setupExternalLinkHandler()
      setupNativeAuthListener()
      const auth = useAuthService()
      let generation = 0
      const synchronize = () => {
        const userId = auth.user.value?.id
        const currentGeneration = ++generation
        if (!userId || !auth.isAuthenticated.value) return
        void nuxtApp.runWithContext(() => syncNativePushRegistration(
          () => currentGeneration === generation
            && auth.isAuthenticated.value && auth.user.value?.id === userId,
        )).catch((error: unknown) => {
          console.warn('[NativePush] Registration failed',
            error instanceof Error ? error.name : 'UnknownError')
        })
      }
      const stop = watch([auth.user, auth.isAuthenticated], synchronize, { immediate: true })
      const onPushChanged = (event: Event) => {
        if (event instanceof CustomEvent && event.detail?.requestId === 'push:changed') synchronize()
      }
      window.addEventListener('nativePushState', onPushChanged)
      nuxtApp.vueApp.onUnmount(() => {
        generation++
        stop()
        window.removeEventListener('nativePushState', onPushChanged)
      })
      
      sendToNative({ type: 'auth:request' })
    } else {
      // 광고 스크립트는 초기 로드가 완전히 끝난 뒤에 로드해 networkidle을 막지 않는다.
      // load 이벤트 후에도 일정 시간을 두어 광고 요청이 초기 로드 측정을 오염시키지 않게 한다.
      const deferAdSense = () => {
        setTimeout(() => {
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => loadAdSense(), { timeout: 5000 })
          } else {
            loadAdSense()
          }
        }, 3000)
      }
      if (document.readyState === 'complete') {
        deferAdSense()
      } else {
        window.addEventListener('load', deferAdSense, { once: true })
      }
    }
  }
})
