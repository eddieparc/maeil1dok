<template>
  <PageLayout title="앱 설치 방법" fallback-path="/">
    <div class="install-content">
      <PWAInstallGuide />
    </div>
  </PageLayout>
</template>

<script setup>
import { useHead } from '#imports'
import PageLayout from '~/components/common/PageLayout.vue'
import PWAInstallGuide from '~/components/PWAInstallGuide.vue'

useHead({
  title: '앱 설치 방법 - 매일일독',
  meta: [
    { name: 'description', content: '매일일독 앱을 휴대폰에 설치하는 방법을 안내합니다. iOS와 Android 모두 지원합니다.' },
    { property: 'og:title', content: '앱 설치 방법 - 매일일독' },
    { property: 'og:description', content: '매일일독 앱을 휴대폰에 설치하는 방법을 안내합니다.' },
    { property: 'og:url', content: 'https://maeil1dok.app/install' },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'ko_KR' },
    { property: 'og:site_name', content: '매일일독' },
  ],
  link: [
    { rel: 'canonical', href: 'https://maeil1dok.app/install' },
  ],
})

</script>

<style scoped>
.install-content { padding: 20px var(--screen-gutter) 32px; }
@media (min-width: 1024px) { .install-content { padding-block: 32px 40px; } }
</style>
