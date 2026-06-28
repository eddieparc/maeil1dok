<template>
  <PageLayout title="앱 설치 방법" fallback-path="/">
    <div class="content-section fade-in" style="animation-delay: 0.2s">
      <PWAInstallGuide />
    </div>
  </PageLayout>
</template>

<script setup>
import { useHead } from '#imports'
import PageLayout from '~/components/common/PageLayout.vue'

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
.content-section {
  background: white;
  margin: 1rem;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  opacity: 0;
  animation: fadeIn 0.4s ease-out forwards;
}
</style>
