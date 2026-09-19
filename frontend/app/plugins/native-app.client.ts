import type { AuthCredentials, NativeToWebViewEvent, WebViewToNativeMessage } from '~/types/native-bridge'

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
  setup() {
    if (typeof window === 'undefined') return
    
    window.__nativeBridge = {
      sendToNative,
      isNativeApp,
      registerAuthCallback,
    }
    
    if (isNativeApp()) {
      setupExternalLinkHandler()
      setupNativeAuthListener()
      
      sendToNative({ type: 'auth:request' })
    } else {
      // 광고 스크립트는 초기 로드가 완전히 끝난 뒤에 로드해 networkidle을 막지 않는다.
      const deferAdSense = () => {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => loadAdSense(), { timeout: 10000 })
        } else {
          setTimeout(() => loadAdSense(), 5000)
        }
      }
      if (document.readyState === 'complete') {
        deferAdSense()
      } else {
        window.addEventListener('load', deferAdSense, { once: true })
      }
    }
  }
})
