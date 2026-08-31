import { useAuthService } from '~/composables/useAuthService'
import { useReadingSettingsStore } from '~/stores/readingSettings'

export default defineNuxtPlugin({
  name: 'auth-init',
  parallel: true,
  setup() {
    const auth = useAuthService()
    const readingSettingsStore = useReadingSettingsStore()

    onNuxtReady(() => {
      void auth.initialize().then(() => {
        if (auth.isAuthenticated.value) {
          return readingSettingsStore.onLogin()
        }
        return undefined
      }).catch((error) => {
        console.error('[auth-init] Failed to initialize auth:', error)
      })

      void readingSettingsStore.initialize().catch((error) => {
        console.error('[auth-init] Failed to initialize reading settings:', error)
      })
    })
  }
})
