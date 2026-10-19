<template>
  <AuthShell back="/login">
    <section v-if="loading" class="auth-status" data-state="checking" role="status" aria-busy="true">
      <LoaderCircle class="auth-status-icon spinner" aria-hidden="true" />
      <h1>링크를 확인하는 중...</h1>
    </section>
    <section v-else-if="invalidToken" class="auth-status" data-state="expired">
      <CircleAlert class="auth-status-icon is-error" aria-hidden="true" />
      <h1>{{ errorCode === 'token_expired' || errorMessage.startsWith('링크가 만료') ? '링크가 만료되었어요' : '사용할 수 없는 링크예요' }}</h1>
      <p class="auth-description">{{ errorMessage }}</p>
      <code v-if="errorCode" class="auth-code">code: {{ errorCode }}</code>
      <AppButton block to="/auth/forgot-password">다시 요청하기</AppButton>
    </section>
    <section v-else-if="success" class="auth-status" data-state="success" role="status">
      <CircleCheck class="auth-status-icon" aria-hidden="true" />
      <h1>비밀번호를 변경했어요</h1>
      <p class="auth-description">새 비밀번호로 로그인할 수 있어요.</p>
      <AppButton block to="/login">로그인하기</AppButton>
      <AppButton block variant="secondary" @click="goToHome">시작하기</AppButton>
    </section>
    <template v-else>
      <h1>새 비밀번호 설정</h1>
      <p class="auth-description">8자 이상 문자와 숫자를 포함해주세요.</p>
      <form class="auth-form" data-state="input" :aria-busy="submitting" @submit.prevent="handleSubmit">
        <div class="auth-field">
          <label for="password">새 비밀번호</label>
          <input id="password" v-model="password" type="password" required minlength="8" autocomplete="new-password" class="auth-input" :disabled="submitting" :aria-invalid="!!passwordError" aria-describedby="password-status" placeholder="8자 이상 문자+숫자">
          <AuthPasswordStrength :password="password" />
          <p id="password-status" class="auth-error" aria-live="polite">{{ passwordError }}</p>
        </div>
        <div class="auth-field">
          <label for="confirmPassword">비밀번호 확인</label>
          <input id="confirmPassword" v-model="confirmPassword" type="password" required autocomplete="new-password" class="auth-input" :class="{ 'input-success': passwordsMatch }" :disabled="submitting" :aria-invalid="!!confirmError" aria-describedby="confirm-status" placeholder="비밀번호 재입력">
          <p id="confirm-status" :class="confirmError ? 'auth-error' : 'auth-success'" aria-live="polite">{{ confirmError || (passwordsMatch ? '비밀번호가 일치해요.' : '') }}</p>
        </div>
        <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>
        <code v-if="errorCode" class="auth-code">code: {{ errorCode }}</code>
        <AppButton type="submit" block :loading="submitting" :disabled="!canSubmit">{{ submitting ? '변경 중...' : '비밀번호 변경' }}</AppButton>
      </form>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { CircleAlert, CircleCheck, LoaderCircle } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '~/components/auth/AuthShell.vue'
import AuthPasswordStrength from '~/components/auth/AuthPasswordStrength.vue'
import AppButton from '~/components/ui/AppButton.vue'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { authErrorCode, authErrorMessage, isAuthPasswordValid, isRejectedResetToken } from '~/utils/authFormUi'
import { useHead } from '#imports'

useHead({ title: '비밀번호 재설정 - 매일일독', meta: [{ name: 'robots', content: 'noindex' }] })
const route = useRoute()
const router = useRouter()
const auth = useAuthService()
const api = useApi()
const loading = ref(true)
const invalidToken = ref(false)
const success = ref(false)
const errorMessage = ref('')
const errorCode = ref('')
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const token = ref('')
const passwordError = computed(() => password.value && !isAuthPasswordValid(password.value) ? '비밀번호는 8자 이상 문자와 숫자를 포함해주세요.' : '')
const confirmError = computed(() => confirmPassword.value && password.value !== confirmPassword.value ? '비밀번호가 일치하지 않습니다.' : '')
const passwordsMatch = computed(() => !!password.value && password.value === confirmPassword.value)
const canSubmit = computed(() => !submitting.value && !loading.value && !invalidToken.value && !!token.value && isAuthPasswordValid(password.value) && passwordsMatch.value)

onMounted(async () => {
  token.value = typeof route.query.token === 'string' ? route.query.token : ''
  if (!token.value) {
    loading.value = false
    invalidToken.value = true
    errorMessage.value = '재설정 토큰이 없습니다. 새로운 링크를 요청해주세요.'
    return
  }
  try {
    // SSOT provides a real POST validation endpoint (not a token-validation GET).
    const data = await api.POST('/api/v1/auth/verify-reset-token/', { token: token.value })
    if (!data.valid) {
      invalidToken.value = true
      errorMessage.value = '유효하지 않은 링크입니다. 새로운 링크를 요청해주세요.'
    }
  } catch (error) {
    // Network/5xx is not expiry. Confirm remains authoritative if the preflight is unavailable.
    invalidToken.value = isRejectedResetToken(error)
    errorMessage.value = authErrorMessage(error, '링크를 확인하지 못했어요. 연결을 확인하고 비밀번호 변경을 다시 시도해주세요.')
    errorCode.value = authErrorCode(error)
  } finally {
    loading.value = false
  }
})

const handleSubmit = async () => {
  if (!canSubmit.value) return
  submitting.value = true
  errorMessage.value = ''
  errorCode.value = ''
  try {
    const data = await api.POST('/api/v1/auth/reset-password/', { token: token.value, new_password: password.value })
    if (!data.success) throw new Error('Password reset failed')
    // The endpoint issues cookies and a user, not access/refresh body tokens.
    if (data.user) auth.setUser(data.user as Parameters<typeof auth.setUser>[0])
    success.value = true
    password.value = ''
    confirmPassword.value = ''
  } catch (error) {
    invalidToken.value = isRejectedResetToken(error)
    errorMessage.value = authErrorMessage(error, '비밀번호 변경 중 오류가 발생했습니다. 다시 시도해주세요.')
    errorCode.value = authErrorCode(error)
  } finally {
    submitting.value = false
  }
}
const goToHome = () => router.push('/')
</script>
