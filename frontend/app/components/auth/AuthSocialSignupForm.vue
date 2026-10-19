<script setup lang="ts">
import { computed } from 'vue'
import { BadgeCheck } from '@lucide/vue'
import AuthShell from './AuthShell.vue'
import AppButton from '~/components/ui/AppButton.vue'
const props = defineProps<{
  provider: 'kakao' | 'google' | 'apple'
  modelValue: string
  error: string
  checked: boolean
  checking: boolean
  loading: boolean
  suggestions: string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; submit: []; retry: [] }>()
const providerName = computed(() => ({ kakao: '카카오', google: '구글', apple: 'Apple' })[props.provider])
</script>

<template>
  <AuthShell back="/login">
    <span class="provider-badge" :class="provider"><BadgeCheck :size="16" aria-hidden="true" />{{ providerName }}로 가입 중</span>
    <h1>매일일독에서 쓸<br>닉네임을 정해주세요</h1>
    <p class="auth-description">닉네임은 나중에 바꿀 수 있어요.</p>
    <form class="auth-form social-form" :aria-busy="loading" @submit.prevent="emit('submit')">
      <div class="auth-field">
        <label for="nickname">닉네임</label>
        <input id="nickname" :value="modelValue" type="text" required autocomplete="nickname" maxlength="20" class="auth-input" :class="{ 'input-success': checked && !error }" :aria-invalid="!!error" :aria-describedby="`${provider}-nickname-status`" :disabled="loading" placeholder="2자 이상 20자 이하" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)">
        <p :id="`${provider}-nickname-status`" :class="error ? 'auth-error' : 'auth-success'" role="status">{{ error || (checking ? '닉네임 확인 중...' : checked ? '사용 가능한 닉네임이에요.' : '') }}</p>
        <AppButton v-if="error && !checking" variant="ghost" size="sm" :disabled="loading" @click="emit('retry')">다시 확인하기</AppButton>
      </div>
      <section v-if="suggestions.length" aria-label="추천 닉네임">
        <p class="auth-description">추천 닉네임이에요. 선택하면 사용 가능한지 확인해요.</p>
        <div class="nickname-suggestions">
          <button v-for="suggestion in suggestions" :key="suggestion" type="button" class="suggestion-chip" :disabled="loading" @click="emit('update:modelValue', suggestion); emit('retry')">{{ suggestion }}</button>
        </div>
      </section>
      <slot />
      <div class="social-submit">
        <AppButton type="submit" size="lg" block :loading="loading" :disabled="loading || !checked || !!error">{{ loading ? '가입 중...' : '시작하기' }}</AppButton>
      </div>
    </form>
  </AuthShell>
</template>

<style scoped>
.provider-badge { align-self: flex-start; display: inline-flex; gap: 6px; align-items: center; padding: 8px 12px; border-radius: var(--radius-pill); font-size: 12px; font-weight: 600; }
.provider-badge.kakao { background: var(--color-kakao-bg); color: var(--color-kakao-text); }
.provider-badge.google { background: #EAF0F7; color: #1E3A5F; }
.provider-badge.apple { background: var(--color-apple-bg); color: var(--color-apple-text); }
.nickname-suggestions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.suggestion-chip { min-width: 44px; min-height: 44px; max-width: 100%; overflow-wrap: anywhere; padding: 8px 14px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-card); color: var(--color-accent-primary); font: inherit; font-size: 13px; cursor: pointer; }
.suggestion-chip:hover:not(:disabled) { background: var(--color-accent-bg); }
.suggestion-chip:active:not(:disabled) { transform: scale(.97); }
.suggestion-chip:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.social-submit { margin-top: auto; position: sticky; bottom: 0; padding-block: 16px max(16px, env(safe-area-inset-bottom, 0px)); background: var(--color-bg-primary); }
@media (prefers-reduced-motion: reduce) { .suggestion-chip:active:not(:disabled) { transform: none; } }
</style>
