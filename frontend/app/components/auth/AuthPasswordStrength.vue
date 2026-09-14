<script setup lang="ts">
import { computed } from 'vue'
import { authPasswordStrength } from '~/utils/authFormUi'
const props = defineProps<{ password: string }>()
const strength = computed(() => authPasswordStrength(props.password))
const label = computed(() => ['', '약함', '보통', '강함'][strength.value])
</script>

<template>
  <div v-if="password" class="password-strength" :data-strength="strength" role="meter" aria-label="비밀번호 강도" :aria-valuenow="strength" aria-valuemin="0" aria-valuemax="3" :aria-valuetext="label">
    <span v-for="segment in 3" :key="segment" class="strength-segment" :class="{ filled: segment <= strength }" aria-hidden="true" />
    <span class="strength-label" aria-hidden="true">{{ label }}</span>
  </div>
</template>

<style scoped>
.password-strength { display: flex; align-items: center; gap: 6px; color: var(--color-error); }
.password-strength[data-strength="2"] { color: var(--color-warning); }
.password-strength[data-strength="3"] { color: var(--color-accent-primary); }
.strength-segment { height: 4px; flex: 1; border-radius: var(--radius-pill); background: var(--color-border-default); }
.strength-segment.filled { background: currentColor; }
.strength-label { font-size: 12px; min-width: 28px; }
</style>
