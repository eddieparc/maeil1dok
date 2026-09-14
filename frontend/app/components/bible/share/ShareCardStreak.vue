<script setup lang="ts">
import { computed } from 'vue';
import { sharePalette, type BibleShareAssets, type BibleShareMetadata, type BibleShareTheme } from '~/composables/bible/bibleShare';
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{
  metadata: BibleShareMetadata;
  assets?: BibleShareAssets;
  square?: boolean;
  theme?: BibleShareTheme;
}>(), { square: false, assets: () => ({ logo: '/images/logo-transparent.png', fontCss: '' }) });
const height = computed(() => props.square ? 360 : 640);
const palette = sharePalette('dark');
const numberSize = computed(() => Math.min(props.square ? 84 : 120, (props.square ? 140 : 220) / Math.max(1, String(props.metadata.streak ?? '').length) * 1.5));
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" :viewBox="`0 0 360 ${height}`" width="360" :height="height" role="img" :aria-label="metadata.streak !== undefined ? `연속 ${metadata.streak}일` : undefined" font-family="ShareKoPub, 'KoPub Batang', serif" letter-spacing="-.4" :fill="palette.text">
    <defs><component :is="'style'">{{ assets.fontCss }}</component></defs>
    <rect width="360" :height="height" :fill="palette.background" />
    <image :href="assets.logo" x="28" :y="square ? 28 : 36" width="61" height="16" style="filter:brightness(0) invert(1)" />
    <text v-if="metadata.dateLabel" x="332" :y="square ? 41 : 49" text-anchor="end" font-size="13" :fill="palette.secondary">{{ metadata.dateLabel }}</text>
    <text v-if="!square && metadata.nickname" x="28" y="252" font-size="19" :fill="palette.secondary" :textLength="metadata.nickname.length > 14 ? 304 : undefined" lengthAdjust="spacingAndGlyphs">{{ metadata.nickname }}님은</text>
    <text v-if="metadata.streak !== undefined" data-streak="true" x="28" :y="square ? 218 : 365" :font-size="numberSize" font-weight="600">{{ metadata.streak }}<tspan dx="8" :font-size="square ? 20 : 30">{{ square ? '일째 읽고 있어요' : '일째' }}</tspan></text>
    <text v-if="!square" x="28" y="411" font-size="24">매일일독 했어요</text>
    <text v-if="square && metadata.readingRange" x="28" y="304" font-size="13" :fill="palette.secondary" :textLength="metadata.readingRange.length > 22 ? 304 : undefined" lengthAdjust="spacingAndGlyphs">{{ metadata.readingRange }}</text>
    <text v-if="metadata.planName" x="28" :y="height - 32" font-size="13" :fill="palette.secondary" :textLength="metadata.planName.length > 18 ? 240 : undefined" lengthAdjust="spacingAndGlyphs">{{ metadata.planName }}</text>
    <text v-if="!square && metadata.progress" data-progress="true" x="332" y="608" text-anchor="end" font-size="14" :fill="palette.secondary">{{ metadata.progress.percent }}%</text>
  </svg>
</template>
