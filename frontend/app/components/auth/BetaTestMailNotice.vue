<template>
  <aside
    v-if="config.public.testMailTransport === 'beta-spool'"
    role="note"
    data-testid="beta-test-mail-notice"
    class="beta-test-mail-notice border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-center text-sm text-[var(--text-primary)]"
  >
    베타 테스트 메일 모드예요. 인증·재설정 메일은 실제로 발송하지 않고 운영자 전용 보관함에 저장해요.
    메일 요청 성공은 테스트 메일 보관을 뜻해요. 링크는 운영자에게 확인해 주세요.
  </aside>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
</script>

<style scoped>
@media (min-width: 1024px) {
  :global(body:has(.sidebar-nav) .beta-test-mail-notice) {
    margin-inline-start: var(--sidebar-width);
  }
}
</style>
