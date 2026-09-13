<script setup lang="ts">
import { NuxtPage } from '#components'
import { useHead } from '#imports'

useHead({
  title: '성경 개론 영상 - 매일일독',
  meta: [
    { name: 'description', content: '성경 각 권의 개론 영상을 시청하세요.' },
    { property: 'og:title', content: '성경 개론 영상 - 매일일독' },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'ko_KR' },
  ],
})
</script>

<template><NuxtPage /></template>
