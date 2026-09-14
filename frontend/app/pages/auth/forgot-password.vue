<template>
  <AuthShell back="/login">
    <template v-if="!submitted">
      <h1>비밀번호 재설정</h1>
      <p class="auth-description">가입할 때 사용한 이메일을 입력해주세요.</p>
      <form class="auth-form" :aria-busy="loading" @submit.prevent="handleSubmit">
        <div class="auth-field">
          <label for="email">이메일</label>
          <input id="email" v-model="email" type="email" required autocomplete="email" class="auth-input" :disabled="loading" placeholder="example@email.com">
        </div>
        <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>
        <code v-if="errorCode" class="auth-code">code: {{ errorCode }}</code>
        <AppButton type="submit" block :loading="loading" :disabled="!canSubmit">{{ loading ? '요청 중...' : '재설정 링크 보내기' }}</AppButton>
        <NuxtLink to="/login" class="auth-link">로그인으로 돌아가기</NuxtLink>
      </form>
    </template>
    <section v-else class="auth-status" data-state="requested">
      <Mail class="auth-status-icon" aria-hidden="true" />
      <h1>이메일을 확인해주세요</h1>
      <p class="auth-description"><strong>{{ requestedEmail }}</strong><br>가입된 계정이라면 비밀번호 재설정 안내가 발송됩니다.</p>
      <p class="auth-description">이메일이 도착하지 않았다면 스팸 폴더도 확인해주세요.</p>
      <p v-if="resendCount" class="auth-success" role="status" :data-resend-count="resendCount">다시 요청했어요 ({{ resendCount }})</p>
      <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>
      <code v-if="errorCode" class="auth-code">code: {{ errorCode }}</code>
      <AppButton block :loading="loading" :disabled="loading" @click="handleSubmit">{{ loading ? '요청 중...' : '메일 다시 보내기' }}</AppButton>
      <NuxtLink to="/login" class="auth-link">로그인으로 돌아가기</NuxtLink>
    </section>
  </AuthShell>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Mail } from '@lucide/vue'
import AuthShell from '~/components/auth/AuthShell.vue'
import AppButton from '~/components/ui/AppButton.vue'
import { useApi } from '~/composables/useApi'
import { useModal } from '~/composables/useModal'
import { authErrorCode, authErrorMessage, isAuthEmailFormat } from '~/utils/authFormUi'
import { useHead } from '#imports'

useHead({ title: '비밀번호 재설정 - 매일일독', meta: [{ name: 'robots', content: 'noindex' }] })
const api = useApi()
const modal = useModal()
const email = ref('')
const requestedEmail = ref('')
const loading = ref(false)
const submitted = ref(false)
const resendCount = ref(0)
const errorMessage = ref('')
const errorCode = ref('')
const canSubmit = computed(() => !loading.value && isAuthEmailFormat(submitted.value ? requestedEmail.value : email.value))
const handleSubmit = async () => {
  if (!canSubmit.value) return
  loading.value = true
  errorMessage.value = ''
  errorCode.value = ''
  try {
    const value = submitted.value ? requestedEmail.value : email.value
    const data = await api.POST('/api/v1/auth/request-password-reset/', { email: value })
    if (!data.success) throw new Error('Password reset request failed')
    if (submitted.value) resendCount.value++
    requestedEmail.value = value
    submitted.value = true
  } catch (error) {
    errorMessage.value = authErrorMessage(error, '요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
    errorCode.value = authErrorCode(error)
    await modal.alert({ title: '오류', description: errorMessage.value, icon: 'error' })
  } finally {
    loading.value = false
  }
}
</script>
