import { useAuthService } from '~/composables/useAuthService'
import { useReadingSettingsStore } from '~/stores/readingSettings'

export default defineNuxtPlugin({
  name: 'auth-init',
  parallel: false,
  async setup(nuxtApp) {
    const auth = useAuthService()
    const readingSettingsStore = useReadingSettingsStore()

    try {
      await auth.initialize()
    } catch (error) {
      console.error('[auth-init] Failed to initialize auth:', error)
    }

    readingSettingsStore.initialize().catch((error) => {
      console.error('[auth-init] Failed to initialize reading settings:', error)
    })
  }
})
