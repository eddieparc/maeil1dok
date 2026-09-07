<script setup lang="ts">
import ShareCardStreak from './ShareCardStreak.vue';
import type { BibleShareAssets, BibleShareMetadata, BibleShareTheme } from '~/composables/bible/bibleShare';
defineOptions({ inheritAttrs: false });
defineProps<{ metadata: BibleShareMetadata; assets?: BibleShareAssets; theme?: BibleShareTheme }>();
</script>

<template>
  <ShareCardStreak :metadata="metadata" :assets="assets" square />
</template>
