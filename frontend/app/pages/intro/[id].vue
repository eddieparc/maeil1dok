<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import IntroDetailContent from '~/components/intro/IntroDetailContent.vue'

const route = useRoute()
const id = computed(() => {
  const value = route.params.id
  return (Array.isArray(value) ? value[0] : value) ?? ''
})
</script>

<template><IntroDetailContent :id="id" /></template>
