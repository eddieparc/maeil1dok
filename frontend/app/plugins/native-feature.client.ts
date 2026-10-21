import { useAuthService } from '~/composables/useAuthService'
import { useReadingSettingsStore } from '~/stores/readingSettings'

declare global {
  interface Window {
    __maeilNativeFeatureContext?: { scope: string; userId: string | null }
    __maeilPrepareNativeReturn?: (requestId: string) => Promise<void>
    __maeilConfirmNativeReturn?: () => Promise<boolean>
  }
}

export default defineNuxtPlugin({
  name: 'native-feature',
  setup(nuxtApp) {
    const context = window.__maeilNativeFeatureContext
    if (!window.ReactNativeWebView || !context) return

    const auth = useAuthService()
    const settings = useReadingSettingsStore()
    let alive = true
    const currentOwner = () => auth.isAuthenticated.value
      ? String(auth.user.value?.id) : null
    const isCurrent = () => alive
      && window.__maeilNativeFeatureContext === context
      && auth.isInitialized.value && !auth.isLoading.value
      && !auth.isSessionUnknown.value && currentOwner() === context.userId
    const send = (message: object) => {
      if (alive) window.ReactNativeWebView?.postMessage(JSON.stringify({
        ...message, scope: context.scope,
      }))
    }
    const prepare = async (requestId: string) => {
      if (typeof requestId !== 'string') return
      try {
        if (isCurrent() && window.__maeilConfirmNativeReturn) {
          send({ type: 'native-feature:confirming', requestId })
          if (!await window.__maeilConfirmNativeReturn()) {
            send({ type: 'native-feature:cancelled', requestId })
            return
          }
          send({ type: 'native-feature:saving', requestId })
        }
        const saved = isCurrent() && await nuxtApp.runWithContext(() => settings.flushPending())
        if (!saved || !isCurrent()) {
          send({ type: 'native-feature:return', requestId, ok: false })
          return
        }
        send({
          type: 'native-feature:return', requestId, ok: true,
          userId: currentOwner(), settings: settings.settings,
        })
      } catch {
        send({ type: 'native-feature:return', requestId, ok: false })
      }
    }
    window.__maeilPrepareNativeReturn = prepare
    nuxtApp.vueApp.onUnmount(() => {
      alive = false
      if (window.__maeilPrepareNativeReturn === prepare) delete window.__maeilPrepareNativeReturn
    })
    onNuxtReady(async () => {
      await auth.initialize()
      if (!isCurrent()) return
      await nuxtApp.runWithContext(() => settings.initialize())
      if (isCurrent()) send({ type: 'native-feature:ready' })
    })
  },
})
