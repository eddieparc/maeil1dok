<script setup lang="ts">
import { useHead } from '#imports'
import InfoLayout from '~/components/info/InfoLayout.vue'
import InfoDocument from '~/components/info/InfoDocument.vue'
import document from '~/data/info/privacy.json'

useHead({
  title: '개인정보처리방침 - 매일일독',
  meta: [
    { name: 'description', content: '매일일독 서비스의 개인정보 처리방침입니다.' },
    { property: 'og:title', content: '개인정보처리방침 - 매일일독' },
    { property: 'og:description', content: '매일일독 서비스의 개인정보 처리방침입니다.' },
    { property: 'og:url', content: 'https://maeil1dok.app/privacy' },
    { property: 'og:type', content: 'website' },
  ],
})
</script>

<template>
  <InfoLayout v-slot="{ navigateSection }">
    <InfoDocument :document="document" :navigate-section="navigateSection" />
  </InfoLayout>
</template>
