<script setup lang="ts">
import { computed } from 'vue';
import { layoutShareText, sharePalette, type BibleShareAssets, type BibleShareCategory, type BibleShareMetadata, type BibleShareTheme } from '~/composables/bible/bibleShare';

const props = withDefaults(defineProps<{
  metadata: BibleShareMetadata;
  assets?: BibleShareAssets;
  format?: BibleShareCategory | 'in-app';
  theme?: BibleShareTheme;
}>(), { format: 'story', theme: 'light', assets: () => ({ logo: '/images/logo-transparent.png', fontCss: '' }) });
const width = computed(() => props.format === 'in-app' ? 320 : 360);
const height = computed(() => props.format === 'in-app' ? 400 : props.format === 'feed' ? 360 : 640);
const padding = computed(() => props.format === 'in-app' ? 24 : 28);
const palette = computed(() => sharePalette(props.theme));
const layout = computed(() => layoutShareText(props.metadata.readingRange || '오늘 통독 완료', width.value - 2 * padding.value, height.value === 640 ? 200 : 120, props.format === 'in-app' ? 29 : height.value === 640 ? 38 : 30));
const progress = computed(() => props.metadata.progress && props.metadata.progress.total > 0 ? props.metadata.progress : undefined);
const progressWidth = computed(() => (width.value - 2 * padding.value) * Math.min(100, Math.max(0, progress.value?.percent ?? 0)) / 100);
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height" role="img" :aria-label="metadata.readingRange || '오늘 통독 완료'" font-family="ShareKoPub, 'KoPub Batang', serif" letter-spacing="-.4" :fill="palette.text">
    <defs><component :is="'style'">{{ assets.fontCss }}</component></defs>
    <rect :width="width" :height="height" :rx="format === 'in-app' ? 20 : 0" :fill="palette.background" />
    <image :href="assets.logo" :x="padding" :y="height === 640 ? 36 : 28" width="61" height="16" :style="theme === 'dark' ? 'filter:brightness(0) invert(1)' : undefined" />
    <text v-if="metadata.dateLabel" :x="width - padding" :y="height === 640 ? 49 : 41" text-anchor="end" font-size="13" :fill="palette.secondary">{{ metadata.dateLabel }}</text>
    <text :x="padding" :y="height / 2 - 40" :font-size="format === 'in-app' ? 15 : 17" :fill="palette.secondary">매일일독 했어요</text>
    <text :x="padding" :y="height / 2 + 8" :font-size="layout.fontSize" font-weight="600">
      <tspan v-for="(line, index) in layout.lines" :key="index" :x="padding" :dy="index ? layout.fontSize * 1.44 : 0">{{ line }}</tspan>
    </text>
    <g v-if="progress" data-progress="true">
      <rect :x="padding" :y="height - 70" :width="width - padding * 2" height="2" :fill="palette.track" />
      <rect :x="padding" :y="height - 70" :width="progressWidth" height="2" :fill="palette.text" />
      <text :x="width - padding" :y="height - 47" text-anchor="end" font-size="12" :fill="palette.secondary">일정 {{ progress.completed }}/{{ progress.total }} · {{ progress.percent }}%</text>
    </g>
    <text v-if="metadata.planName" :x="padding" :y="height - 28" font-size="13" :fill="palette.secondary" :textLength="metadata.planName.length > 15 ? width - padding * 2 : undefined" lengthAdjust="spacingAndGlyphs">{{ metadata.planName }}</text>
    <text v-if="metadata.streak !== undefined" data-streak="true" :x="padding" :y="height - 47" font-size="12" :fill="palette.secondary">연속 {{ metadata.streak }}일</text>
  </svg>
</template>
