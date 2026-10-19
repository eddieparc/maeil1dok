<script setup lang="ts">
import { ref, watch } from 'vue'
import { Download } from '@lucide/vue'
import AdminConsoleLayout from '~/components/admin/AdminConsoleLayout.vue'
import MemberConsole from '~/components/admin/member-console.vue'
import AppButton from '~/components/ui/AppButton.vue'

definePageMeta({ layout: false })
useHead({ title: '회원 관리 - 매일일독', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const consoleRef = ref<InstanceType<typeof MemberConsole> | null>(null)
const masked = ref(true)
watch(consoleRef, value => { if (!value) masked.value = true })
</script>

<template>
  <AdminConsoleLayout title="회원">
    <template #title>
      <h1>회원</h1>
      <p class="member-summary">
        전체 {{ consoleRef?.state.stats?.total.toLocaleString('ko-KR') ?? '—' }}명 ·
        이번 주 신규 {{ consoleRef?.state.stats?.new_this_week.toLocaleString('ko-KR') ?? '—' }}명 ·
        검색 결과 {{ consoleRef?.state.list?.count.toLocaleString('ko-KR') ?? '—' }}명
      </p>
    </template>
    <template #actions>
      <label class="member-mask"><input v-model="masked" data-action="csv-mask" type="checkbox" /> 개인정보 마스킹</label>
      <AppButton data-action="export" variant="secondary" :loading="consoleRef?.state.exporting" :disabled="!consoleRef" @click="consoleRef?.state.exportCsv(masked)"><Download :size="18" aria-hidden="true" />CSV 내보내기</AppButton>
    </template>
    <MemberConsole ref="consoleRef" />
  </AdminConsoleLayout>
</template>

<style scoped>
.member-summary { margin: 8px 0 0; color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.member-mask { display: flex; align-items: center; gap: 8px; min-height: var(--hit-min); font-size: 13px; cursor: pointer; }
.member-mask input { width: 18px; height: 18px; accent-color: var(--color-accent-primary); }
.member-mask:focus-within { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-radius: var(--radius-control); }
</style>
