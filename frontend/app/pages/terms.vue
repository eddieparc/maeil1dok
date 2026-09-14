<script setup lang="ts">
import { useHead } from '#imports'
import InfoLayout from '~/components/info/InfoLayout.vue'
import InfoDocument from '~/components/info/InfoDocument.vue'
import document from '~/data/info/terms.json'

useHead({
  title: '이용약관 - 매일일독',
  meta: [
    { name: 'description', content: '매일일독 서비스의 이용약관입니다.' },
    { property: 'og:title', content: '이용약관 - 매일일독' },
    { property: 'og:description', content: '매일일독 서비스의 이용약관입니다.' },
    { property: 'og:url', content: 'https://maeil1dok.app/terms' },
    { property: 'og:type', content: 'website' },
  ],
})
</script>

<template>
  <InfoLayout v-slot="{ navigateSection }">
    <InfoDocument :document="document" :navigate-section="navigateSection" />
  </InfoLayout>
</template>
