<script lang="ts">
import { defineComponent } from 'vue'
import { useToast } from '~/composables/useToast'
import type { ToastType } from '~/types/toast'

export default defineComponent({
  setup(_, { expose }) {
    const toast = useToast()
    const show = (message: string, type: ToastType = 'success') => toast.show({ message, type })
    expose({ show })
    // Keep the same renderless placeholder in SSR and hydration. A comment-only
    // template is stripped from production SSR but becomes a client comment.
    return () => null
  },
})
</script>
