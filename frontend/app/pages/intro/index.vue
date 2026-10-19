<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PageLayout from '~/components/common/PageLayout.vue'
import IntroListContent from '~/components/IntroListContent.vue'
import IntroDetailContent from '~/components/intro/IntroDetailContent.vue'

const route = useRoute()
// Keep existing schedule/notification links working without a client-only redirect.
const legacyId = computed(() => Array.isArray(route.query.id) ? route.query.id[0] : route.query.id)
</script>

<template>
  <IntroDetailContent v-if="route.query.id !== undefined" :id="legacyId ?? ''" />
  <PageLayout v-else title="개론 영상" fallback-path="/"><IntroListContent /></PageLayout>
</template>
