<script setup lang="ts">
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue';
import BottomSheet from '~/components/ui/BottomSheet.vue';
import ShareCardVerse from './ShareCardVerse.vue';
import ShareCardSummary from './ShareCardSummary.vue';
import ShareCardStreak from './ShareCardStreak.vue';
import ShareCardFeed from './ShareCardFeed.vue';
import { createBibleShareState, loadBibleShareAssets, prepareBibleShareImage, type BibleShareAssets, type BibleShareCategory, type BibleShareSlide } from '~/composables/bible/bibleShare';
import type { ShareSheetProps } from '../../../composables/bible/bibleShare';
import { useCertificationShare, type CertificationShareResult, type PreparedCertificationImage } from '~/composables/useCertificationShare';

const props = defineProps<ShareSheetProps>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
  ready: [image: PreparedCertificationImage];
  'selection-change': [selection: { category: BibleShareCategory; index: number; slide: BibleShareSlide | undefined }];
  result: [value: { action: 'share' | 'save' | 'copy'; result: CertificationShareResult }];
  error: [error: Error];
}>();
const state = reactive(createBibleShareState(props));
const assets = shallowRef<BibleShareAssets>();
const prepared = shallowRef<PreparedCertificationImage>();
const carousel = ref<HTMLElement>();
const busy = ref(false);
const status = ref('');
const retry = ref(0);
const preparationError = ref(false);
const { shareCertification, downloadCertificationImage, copyCertificationLink } = useCertificationShare();
const active = computed(() => state.slides[state.index]);
const disabled = computed(() => busy.value || props.loading || !prepared.value);
const cards = { verse: ShareCardVerse, summary: ShareCardSummary, streak: ShareCardStreak, feed: ShareCardFeed };

function close(value: boolean) {
  emit('update:modelValue', value);
  if (!value) emit('close');
}
function centerSlide() {
  const element = carousel.value;
  const slide = element?.querySelectorAll<HTMLElement>('[data-share-slide]')[state.index];
  if (element && slide) element.scrollTo({ left: slide.offsetLeft + slide.offsetWidth / 2 - element.clientWidth / 2, behavior: 'instant' });
}
async function category(value: BibleShareCategory) {
  state.setCategory(value);
  await nextTick();
  centerSlide();
}
function select(index: number) { state.select(index); centerSlide(); }
function scroll(event: Event) {
  const element = event.currentTarget as HTMLElement;
  const center = element.scrollLeft + element.clientWidth / 2;
  let distance = Infinity;
  let index = 0;
  element.querySelectorAll<HTMLElement>('[data-share-slide]').forEach((slide, candidate) => {
    const delta = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center);
    if (delta < distance) { distance = delta; index = candidate; }
  });
  state.select(index);
}
watch(() => [props.modelValue, props.mode, props.verses, props.metadata], () => {
  state.index = 0;
}, { deep: true, flush: 'sync' });
watch(() => [state.category, state.index, active.value], () => {
  emit('selection-change', { category: state.category, index: state.index, slide: active.value });
}, { immediate: true });

// Invalidate synchronously, before a second tap can export the previous slide.
// Cleanup owns every await boundary: a closed/rebuilt sheet cannot publish stale files.
watch(() => [props.modelValue, props.loading, props.mode, props.metadata, props.verses, state.category, state.index, state.theme, retry.value], async (_, __, onCleanup) => {
  let current = true;
  onCleanup(() => { current = false; });
  prepared.value = undefined;
  preparationError.value = false;
  status.value = '';
  if (!props.modelValue || props.loading || !active.value) return;
  try {
    const loaded = await loadBibleShareAssets();
    if (!current) return;
    assets.value = loaded;
    await nextTick();
    if (!current) return;
    const svg = carousel.value?.querySelectorAll<HTMLElement>('[data-share-slide]')[state.index]?.querySelector('svg');
    if (!svg) throw new Error('공유 카드 미리보기를 찾지 못했습니다.');
    const image = await prepareBibleShareImage(svg);
    if (!current) return;
    prepared.value = image;
    emit('ready', image);
  } catch (error) {
    if (!current) return;
    const failure = error instanceof Error ? error : new Error(String(error));
    preparationError.value = true;
    status.value = failure.message;
    emit('error', failure);
  }
}, { immediate: true, deep: true, flush: 'sync' });

async function action(kind: 'share' | 'save' | 'copy') {
  if (busy.value || (kind !== 'copy' && disabled.value)) return;
  busy.value = true;
  status.value = '';
  const payload = { preparedImage: prepared.value, shareUrl: props.shareUrl, title: active.value?.label, subtitle: active.value?.verse?.text, planId: props.planId, scheduleId: props.scheduleId, dateLabel: props.metadata.dateLabel };
  try {
    let result: CertificationShareResult;
    // Call transport before the first await. SVG/font work already completed.
    if (kind === 'share') result = await shareCertification(payload);
    else if (kind === 'save') {
      await downloadCertificationImage(undefined, payload);
      result = 'downloaded';
    } else {
      await copyCertificationLink(props.shareUrl);
      result = 'copied';
    }
    status.value = result === 'copied' ? '링크가 복사되었습니다.' : result === 'downloaded' ? '이미지 저장 작업을 열었어요.' : '공유 작업을 마쳤어요.';
    emit('result', { action: kind, result });
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    status.value = failure.message;
    emit('error', failure);
  } finally { busy.value = false; }
}
</script>

<template>
  <BottomSheet :model-value="modelValue" :title="mode === 'verse' ? '구절 공유' : '통독 완료 공유'" class="bible-share-sheet" data-testid="bible-share-sheet" @update:model-value="close">
    <template #header-extra>
      <div v-if="state.themeEligible" class="share-theme" role="group" aria-label="카드 테마">
        <button type="button" :aria-pressed="state.theme === 'light'" data-testid="share-theme-light" @click="state.theme = 'light'">밝게</button>
        <button type="button" :aria-pressed="state.theme === 'dark'" data-testid="share-theme-dark" @click="state.theme = 'dark'">어둡게</button>
      </div>
    </template>
    <div class="share-categories" role="group" aria-label="공유 이미지 비율">
      <button type="button" :aria-pressed="state.category === 'story'" data-testid="share-category-story" @click="category('story')">스토리 9:16</button>
      <button type="button" :aria-pressed="state.category === 'feed'" data-testid="share-category-feed" @click="category('feed')">게시물 1:1</button>
    </div>
    <slot name="status" />
    <p v-if="loading" class="share-status" role="status">공유 정보를 불러오고 있습니다.</p>
    <p v-else-if="!state.slides.length" class="share-status" role="status">공유할 구절이 없습니다.</p>
    <div v-else :key="state.category" ref="carousel" class="share-carousel" :class="state.category" data-testid="share-carousel" role="region" aria-label="공유 카드" @scroll="scroll">
      <article v-for="(slide, index) in state.slides" :key="`${state.category}:${slide.id}`" class="share-slide" :class="{ selected: index === state.index }" data-share-slide :aria-label="`${index + 1}/${state.slides.length} ${slide.label}`">
        <component :is="cards[slide.kind]" :metadata="metadata" :verse="slide.verse" :assets="assets" :format="state.category" :theme="state.theme" />
      </article>
    </div>
    <div v-if="state.slides.length && !loading" class="share-dots" aria-label="카드 선택">
      <button v-for="(slide, index) in state.slides" :key="slide.id" type="button" :data-testid="`share-dot-${index}`" :aria-label="`${index + 1}: ${slide.label}`" :aria-current="index === state.index ? 'true' : undefined" @click="select(index)"><span /></button>
    </div>
    <p v-if="active && !loading" class="share-label" aria-live="polite">{{ active.label }}</p>
    <p v-if="status" class="share-status" role="status">{{ status }}</p>
    <p v-else-if="!prepared && active && !loading" class="share-status" role="status">이미지를 준비하고 있습니다.</p>
    <button v-if="preparationError" type="button" class="share-retry" @click="retry++">다시 시도</button>
    <template #footer>
      <div class="share-actions">
        <button type="button" :disabled="disabled" data-testid="share-save" @click="action('save')">이미지 저장</button>
        <button type="button" :disabled="disabled" class="primary" data-testid="share-send" @click="action('share')">공유하기</button>
      </div>
      <button v-if="shareUrl" type="button" class="share-copy" :disabled="busy" @click="action('copy')">링크 복사</button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.share-theme, .share-categories { display: flex; padding: 3px; gap: 3px; border-radius: var(--radius-pill); background: var(--color-bg-secondary); }
.share-theme { margin-left: auto; }
button { min-height: 44px; border: 1px solid transparent; border-radius: var(--radius-pill); font: inherit; cursor: pointer; }
.share-theme button { padding: 0 10px; font-size: 12px; }
.share-categories button { flex: 1; font-size: 13px; font-weight: 600; }
.share-theme button, .share-categories button { color: var(--color-text-secondary); background: transparent; }
button[aria-pressed="true"] { background: var(--color-bg-card); color: var(--color-accent-primary); box-shadow: var(--shadow-sm); }
.share-carousel { --preview-width: 187.2px; position: relative; display: flex; gap: 12px; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; padding: 18px max(0px, calc((100% - var(--preview-width)) / 2)) 8px; scrollbar-width: none; }
.share-carousel.feed { --preview-width: 266.4px; }
.share-carousel::-webkit-scrollbar { display: none; }
.share-slide { flex: 0 0 var(--preview-width); width: var(--preview-width); scroll-snap-align: center; opacity: .55; transform: scale(.94); transform-origin: center; transition: opacity 150ms ease, transform 150ms ease; overflow: hidden; box-shadow: var(--shadow-card); }
.share-slide.selected { opacity: 1; transform: scale(1); }
.share-slide :deep(svg) { display: block; width: 100%; height: auto; }
.share-dots { display: flex; justify-content: center; flex-wrap: wrap; }
.share-dots button { display: grid; place-items: center; min-width: 44px; padding: 0; background: transparent; }
.share-dots span { display: block; width: 6px; height: 6px; border-radius: var(--radius-pill); background: var(--color-border-default); }
.share-dots [aria-current="true"] span { width: 18px; background: var(--color-accent-primary); }
.share-label, .share-status { margin: 0; text-align: center; color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.share-status { margin-top: 8px; }
.share-actions { display: flex; gap: 10px; }
.share-actions button { flex: 1; padding: 0 16px; background: var(--color-bg-secondary); color: var(--color-accent-primary); font-weight: 600; }
.share-actions .primary { color: var(--color-text-inverse); background: var(--color-accent-primary); }
.share-copy, .share-retry { display: block; margin: 6px auto 0; padding: 0 18px; background: transparent; color: var(--color-accent-primary); }
button:disabled { cursor: not-allowed; opacity: .45; }
button:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .share-slide { transition: none; } }
</style>
