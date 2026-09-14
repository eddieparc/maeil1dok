<script setup lang="ts">
import { computed } from 'vue';
import { layoutShareText, sharePalette, type BibleShareAssets, type BibleShareCategory, type BibleShareMetadata, type BibleShareTheme, type BibleShareVerse } from '~/composables/bible/bibleShare';

const props = withDefaults(defineProps<{
  verse: BibleShareVerse;
  metadata: BibleShareMetadata;
  assets?: BibleShareAssets;
  format?: BibleShareCategory;
  theme?: BibleShareTheme;
}>(), { format: 'story', theme: 'light', assets: () => ({ logo: '/images/logo-transparent.png', fontCss: '' }) });
const square = computed(() => props.format === 'feed');
const height = computed(() => square.value ? 360 : 640);
const palette = computed(() => sharePalette(props.theme));
const layout = computed(() => layoutShareText(props.verse.text, 304, square.value ? 210 : 390, square.value ? 26 : 34));
const textY = computed(() => (height.value - layout.value.lines.length * layout.value.fontSize * 1.44) / 2 + layout.value.fontSize);
const footer = computed(() => [props.metadata.nickname ? `${props.metadata.nickname}님이 오늘 읽은 말씀이에요` : '', props.metadata.streak !== undefined ? `연속 ${props.metadata.streak}일` : ''].filter(Boolean).join(' · '));
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" :viewBox="`0 0 360 ${height}`" width="360" :height="height" role="img" :aria-label="verse.reference" font-family="ShareKoPub, 'KoPub Batang', serif" letter-spacing="-.4" :fill="palette.text">
    <defs><component :is="'style'">{{ assets.fontCss }}</component></defs>
    <rect width="360" :height="height" :fill="palette.background" />
    <image :href="assets.logo" x="28" :y="square ? 28 : 36" width="61" height="16" :style="theme === 'dark' ? 'filter:brightness(0) invert(1)' : undefined" />
    <text v-if="metadata.dateLabel" x="332" :y="square ? 41 : 49" text-anchor="end" font-size="13" :fill="palette.secondary">{{ metadata.dateLabel }}</text>
    <text x="28" :y="textY" :font-size="layout.fontSize" font-weight="600" xml:space="preserve">
      <tspan v-for="(line, index) in layout.lines" :key="index" x="28" :dy="index ? layout.fontSize * 1.44 : 0">{{ line }}</tspan>
    </text>
    <text x="28" :y="square ? 328 : Math.min(textY + layout.lines.length * layout.fontSize * 1.44 + 18, 555)" :font-size="square ? 12 : 15" :fill="palette.secondary">{{ verse.reference }}</text>
    <text v-if="square" x="332" y="328" text-anchor="end" font-size="12" :fill="palette.secondary">2026 성경통독</text>
    <text v-else-if="!square && footer" x="28" y="608" font-size="14" :fill="palette.secondary" :textLength="footer.length > 22 ? 304 : undefined" lengthAdjust="spacingAndGlyphs">{{ footer }}</text>
  </svg>
</template>
