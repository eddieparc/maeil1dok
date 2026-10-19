<template>
  <AuthSocialSignupForm v-model="nickname" provider="kakao" :error="nicknameError" :checked="isNicknameChecked" :checking="checkingNickname" :loading="loading" :suggestions="suggestions" @submit="handleSubmit" @retry="checkNickname">
    <p v-if="submitError" class="auth-error" role="alert">{{ submitError }}</p>
    <code v-if="submitCode" class="auth-code">code: {{ submitCode }}</code>
  </AuthSocialSignupForm>
</template>

<script setup lang="ts">
import AuthSocialSignupForm from '~/components/auth/AuthSocialSignupForm.vue'
import { useSocialSignupSetup } from '~/composables/useSocialSignupSetup'

const {
  nickname,
  nicknameError,
  isNicknameChecked,
  checkingNickname,
  checkNickname,
  loading,
  suggestions,
  submitError,
  submitCode,
  handleSubmit,
} = useSocialSignupSetup('kakao')
</script>
