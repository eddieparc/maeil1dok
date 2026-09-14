<template>
  <AuthShell>
    <section v-if="loading" class="auth-status" data-state="checking" role="status" aria-busy="true">
      <LoaderCircle class="auth-status-icon spinner" aria-hidden="true" />
      <h1>이메일 인증 중...</h1>
      <p class="auth-description">잠시만 기다려주세요.</p>
    </section>
    <section v-else-if="success" class="auth-status" data-state="success" role="status">
      <CircleCheck class="auth-status-icon" aria-hidden="true" />
      <h1>이메일 인증 완료</h1>
      <p class="auth-description">{{ verifiedNickname ? `${verifiedNickname}님, 환영해요.` : '환영해요.' }} 이제 오늘의 통독을 시작할 수 있어요.</p>
      <AppButton block @click="goToHome">시작하기</AppButton>
    </section>
    <section v-else class="auth-status" data-state="error">
      <CircleAlert class="auth-status-icon is-error" aria-hidden="true" />
      <h1>인증에 실패했어요</h1>
      <p class="auth-description" role="alert">{{ errorMessage }}</p>
      <code v-if="errorCode" class="auth-code">code: {{ errorCode }}</code>
      <form class="auth-actions" :aria-busy="resending" @submit.prevent="resendEmail">
        <div v-if="!auth.isAuthenticated.value" class="auth-field resend-email-field">
          <label for="email">인증 메일을 받을 이메일</label>
          <input id="email" v-model="userEmail" type="email" required autocomplete="email" class="auth-input" :disabled="resending" placeholder="가입한 이메일">
        </div>
        <p v-if="resendMessage" class="auth-success" role="status">{{ resendMessage }}</p>
        <p v-if="resendError" class="auth-error" role="alert">{{ resendError }}</p>
        <AppButton type="submit" block :loading="resending" :disabled="!canResend">{{ resending ? '요청 중...' : '인증 메일 다시 보내기' }}</AppButton>
        <AppButton variant="secondary" block @click="goToLogin">로그인으로 이동</AppButton>
      </form>
      <NuxtLink to="/support" class="auth-link">고객 지원</NuxtLink>
    </section>
  </AuthShell>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { CircleAlert, CircleCheck, LoaderCircle } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '~/components/auth/AuthShell.vue'
import AppButton from '~/components/ui/AppButton.vue'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { authErrorCode, authErrorMessage, isAuthEmailFormat } from '~/utils/authFormUi'
import { useHead } from '#imports'

useHead({ title: '이메일 인증 - 매일일독', meta: [{ name: 'robots', content: 'noindex' }] })
const route = useRoute()
const router = useRouter()
const auth = useAuthService()
const api = useApi()
const loading = ref(true)
const success = ref(false)
const verifiedNickname = ref('')
const errorMessage = ref('')
const errorCode = ref('')
const resending = ref(false)
const userEmail = ref('')
const resendMessage = ref('')
const resendError = ref('')
const canResend = computed(() => !resending.value && (auth.isAuthenticated.value || isAuthEmailFormat(userEmail.value)))

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : ''
  if (!token) {
    loading.value = false
    errorMessage.value = '인증 토큰이 없습니다. 인증 메일의 링크를 다시 확인해주세요.'
    return
  }
  try {
    const data = await api.POST('/api/v1/auth/verify-email/', { token })
    if (!data.success) throw new Error('Email verification failed')
    if (data.user) {
      auth.setUser(data.user as Parameters<typeof auth.setUser>[0])
      verifiedNickname.value = typeof data.user.nickname === 'string' ? data.user.nickname : ''
    }
    success.value = true
  } catch (error) {
    errorMessage.value = authErrorMessage(error, '인증을 처리하지 못했어요. 연결 상태와 인증 링크를 확인해주세요.')
    errorCode.value = authErrorCode(error)
  } finally {
    loading.value = false
  }
})

const resendEmail = async () => {
  if (!canResend.value) return
  resending.value = true
  resendMessage.value = ''
  resendError.value = ''
  try {
    const authenticated = auth.isAuthenticated.value
    const data = authenticated
      ? await api.POST('/api/v1/auth/resend-verification/')
      : await api.POST('/api/v1/auth/send-verification/', { email: userEmail.value })
    if (!data.success) throw new Error('Verification request failed')
    resendMessage.value = authenticated ? '인증 메일을 발송했어요. 메일함을 확인해주세요.' : '가입된 이메일이라면 인증 메일이 발송됩니다. 메일함을 확인해주세요.'
  } catch (error) {
    resendError.value = authErrorMessage(error, '메일을 요청하지 못했어요. 다시 시도해주세요.')
  } finally {
    resending.value = false
  }
}
const goToHome = () => router.push('/')
const goToLogin = () => router.push('/login')
</script>

<style scoped>
.resend-email-field { text-align: left; }
</style>
