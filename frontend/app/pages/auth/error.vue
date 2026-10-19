<template>
  <AuthShell>
    <section class="auth-status" data-state="error">
      <CircleAlert class="auth-status-icon is-error" aria-hidden="true" />
      <h1>로그인을 완료하지 못했어요</h1>
      <p class="auth-description">{{ description }}</p>
      <div class="auth-code"><code>code: {{ reason }}</code><template v-if="observedAt"> · <time :datetime="observedAt">{{ observedAt }}</time></template></div>
      <div class="auth-actions">
        <AppButton block @click="goToLogin">다시 로그인</AppButton>
        <AppButton block variant="secondary" @click="goToHome">홈으로</AppButton>
      </div>
    </section>
  </AuthShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CircleAlert } from '@lucide/vue'
import AuthShell from '~/components/auth/AuthShell.vue'
import AppButton from '~/components/ui/AppButton.vue'
import { firstQueryValue } from '#shared/utils/authCallbackRuntime'

definePageMeta({ layout: false })
const route = useRoute()
const router = useRouter()
const reason = computed(() => firstQueryValue(route.query.code) || firstQueryValue(route.query.reason) || 'unknown')
const observedAt = ref('')
onMounted(() => { observedAt.value = new Date().toISOString() })
const messages: Record<string, string> = {
  provider_denied: '로그인 제공자에서 요청이 취소되었어요. 다시 로그인해주세요.',
  code_required: '인증 코드가 없습니다. 다시 로그인해주세요.',
  invalid_code: '인증 코드가 만료되었거나 이미 사용되었어요. 다시 로그인해주세요.',
  user_not_found: '계정 정보를 확인할 수 없습니다. 다시 로그인해주세요.',
}
const description = computed(() => messages[reason.value] || '로그인 과정에서 문제가 발생했습니다. 다시 시도해주세요.')
const goToLogin = () => router.push('/login')
const goToHome = () => router.push('/')
</script>
