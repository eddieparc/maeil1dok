/**
 * 네이티브 앱 ↔ WebView 통신 규약
 * 
 * 원칙:
 * 1. 네이티브 앱이 인증의 주체 (AsyncStorage = 단일 진실 소스)
 * 2. WebView는 수동적 (네이티브 앱의 인증 상태를 따름)
 * 3. 모든 인증 상태 변경은 명시적 메시지로 통신
 */

export interface AuthUser {
  id: number
  username: string
  nickname: string
  email?: string
  profile_image?: string
}

export interface AuthCredentials {
  token: string
  refreshToken: string
  user: AuthUser
}

// WebView → Native 메시지 타입
export type WebViewToNativeMessage =
  | { type: 'auth:login'; data: AuthCredentials }
  | { type: 'auth:logout' }
  | { type: 'auth:expired' }
  | { type: 'auth:request' }
  | { type: 'auth:apple:link'; data: { state: string } }
  | { type: 'navigate'; url: string }

// Native → WebView 이벤트 타입
export type NativeToWebViewEvent =
  | { type: 'token'; data: AuthCredentials }
  | { type: 'logout' }
  | {
      type: 'auth:apple:link:result'
      data: {
        state: string
        idToken?: string
        code?: string
        error?: 'cancelled' | 'unavailable'
      }
    }

declare global {
  interface Window {
    isReactNativeWebView?: boolean
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
    __nativeBridge?: {
      sendToNative: (message: WebViewToNativeMessage) => void
      isNativeApp: () => boolean
      registerAuthCallback: (
        onAuth: (credentials: AuthCredentials) => void,
        onLogout: () => void
      ) => void
    }
  }
}

export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && window.isReactNativeWebView === true
}

export function sendToNative(message: WebViewToNativeMessage): void {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message))
  }
}
