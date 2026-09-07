<template>
  <BottomSheet :model-value="modelValue" title="읽기 설정" class="reading-settings-sheet" @update:model-value="emit('update:modelValue', $event)">
    <template #header-extra>
      <AppButton class="done-btn" variant="ghost" size="sm" @click="closeSheet">완료</AppButton>
    </template>

    <div v-if="settingsStore.syncError" class="sync-error" role="alert">
      <p>{{ settingsStore.syncError }}</p>
      <AppButton data-testid="reading-settings-retry" variant="ghost" size="sm" :disabled="settingsStore.isLoading || settingsStore.isSyncing" @click="settingsStore.syncToServer()">다시 시도</AppButton>
    </div>
    <section class="settings-section" aria-labelledby="font-label">
      <h2 id="font-label" class="section-title">글꼴</h2>
      <div class="font-options">
        <button
          v-for="font in fontOptions"
          :key="font.value"
          type="button"
          class="font-button"
          :class="{ active: settings.fontFamily === font.value }"
          :aria-pressed="settings.fontFamily === font.value"
          :style="{ fontFamily: FONT_FAMILIES[font.value].css }"
          @click="updateSetting('fontFamily', font.value)"
        >{{ font.label }}</button>
      </div>
    </section>

    <div class="slider-group">
      <div class="slider-row">
        <label for="reading-font-size">글자 크기</label>
        <output for="reading-font-size">{{ settings.fontSize }}px</output>
        <input id="reading-font-size" type="range" :value="settings.fontSize" min="14" max="24" step="1" @input="updateSetting('fontSize', Number(($event.target as HTMLInputElement).value))" />
      </div>
      <div class="slider-row">
        <label for="reading-line-height">줄 간격</label>
        <output for="reading-line-height">{{ settings.lineHeight.toFixed(1) }}</output>
        <input id="reading-line-height" type="range" :value="settings.lineHeight" min="1.4" max="2.2" step="0.1" @input="updateSetting('lineHeight', Number(($event.target as HTMLInputElement).value))" />
      </div>
    </div>

    <div class="toggle-item name-toggle">
      <span id="highlight-names-label" class="toggle-title">인명·지명 강조</span>
      <button type="button" class="switch-hit" role="switch" :aria-checked="settings.highlightNames" aria-labelledby="highlight-names-label" @click="updateSetting('highlightNames', !settings.highlightNames)">
        <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
      </button>
    </div>

    <details class="advanced-settings">
      <summary>추가 설정 및 데이터 관리</summary>
      <section class="preview-section" aria-label="본문 미리보기">
        <span class="preview-label">본문 미리보기</span>
        <h3>창세기 1장</h3>
        <div class="preview-content" :style="previewStyles" :class="{ 'highlight-names': settings.highlightNames }">
          <p v-if="settings.verseJoining" class="verse-paragraph">
            <sup v-if="settings.showVerseNumbers" class="verse-number">1</sup>태초에 <span class="bible-name">하나님</span>이 천지를 창조하시니라
            <sup v-if="settings.showVerseNumbers" class="verse-number">2</sup>땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 <span class="bible-name">하나님</span>의 영은 수면 위에 운행하시니라
          </p>
          <template v-else>
            <p class="preview-verse">
              <span v-if="settings.showVerseNumbers" class="verse-number">1</span>
              <span>태초에 <span class="bible-name">하나님</span>이 천지를 창조하시니라</span>
            </p>
            <p class="preview-verse">
              <span v-if="settings.showVerseNumbers" class="verse-number">2</span>
              <span>땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 <span class="bible-name">하나님</span>의 영은 수면 위에 운행하시니라</span>
            </p>
          </template>
        </div>
      </section>
      <section class="settings-section">
        <h2 class="section-title">테마</h2>
        <div class="chip-buttons">
          <button v-for="theme in themeOptions" :key="theme.value" type="button" class="chip-btn" :aria-pressed="settings.theme === theme.value" @click="updateSetting('theme', theme.value)">{{ theme.label }}</button>
        </div>
      </section>
      <section class="settings-section">
        <h2 class="section-title">두께</h2>
        <div class="chip-buttons">
          <button v-for="option in fontWeightOptions" :key="option.value" type="button" class="chip-btn" :aria-pressed="settings.fontWeight === option.value" :style="{ fontWeight: FONT_WEIGHTS[option.value] }" @click="updateSetting('fontWeight', option.value)">{{ option.label }}</button>
        </div>
      </section>
      <section class="settings-section">
        <h2 class="section-title">정렬</h2>
        <div class="chip-buttons">
          <button v-for="option in textAlignOptions" :key="option.value" type="button" class="chip-btn" :aria-pressed="settings.textAlign === option.value" @click="updateSetting('textAlign', option.value)">{{ option.label }}</button>
        </div>
      </section>
      <div v-for="option in readingOptions" :key="option.value" class="toggle-item">
        <span :id="option.value" class="toggle-title">{{ option.label }}</span>
        <button type="button" class="switch-hit" role="switch" :aria-checked="settings[option.value]" :aria-labelledby="option.value" @click="updateSetting(option.value, !settings[option.value])">
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
        </button>
      </div>
      <nav class="quick-links" aria-label="성경 기록">
        <NuxtLink to="/bible/bookmarks">북마크</NuxtLink>
        <NuxtLink to="/bible/notes">노트</NuxtLink>
        <NuxtLink to="/bible/highlights">하이라이트</NuxtLink>
      </nav>
      <section class="settings-section danger-section">
        <h2 class="section-title">데이터 관리</h2>
        <p>아래 작업은 되돌릴 수 없습니다.</p>
        <div class="danger-buttons">
          <AppButton variant="danger" :disabled="isDeleting" @click="deleteAllBookmarks">북마크 전체 삭제</AppButton>
          <AppButton variant="danger" :disabled="isDeleting" @click="deleteAllNotes">노트 전체 삭제</AppButton>
          <AppButton variant="danger" :disabled="isDeleting" @click="deleteAllHighlights">하이라이트 전체 삭제</AppButton>
          <AppButton variant="danger" :disabled="isDeleting" @click="resetAllSettings">모든 설정 초기화</AppButton>
        </div>
      </section>
    </details>
  </BottomSheet>
  <Toast />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  useReadingSettingsStore,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  type FontFamily,
  type ThemeMode,
  type FontWeight,
  type TextAlign
} from '~/stores/readingSettings';
import { useAuthService } from '~/composables/useAuthService';
import { useApi } from '~/composables/useApi';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useModal } from '~/composables/useModal';
import { useToast } from '~/composables/useToast';
import BottomSheet from '~/components/ui/BottomSheet.vue';
import AppButton from '~/components/ui/AppButton.vue';
import Toast from '~/components/Toast.vue';

const props = withDefaults(defineProps<{ modelValue: boolean; currentVersion?: string }>(), { currentVersion: 'KRV' });
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const settingsStore = useReadingSettingsStore();
const auth = useAuthService();
const api = useApi();
const toast = useToast();
const modal = useModal();
const { handleApiError } = useErrorHandler();
const isDeleting = ref(false);
const settings = computed(() => settingsStore.settings);
const closeSheet = () => emit('update:modelValue', false);
onMounted(() => { if (props.modelValue) void settingsStore.initialize(); });
watch(() => props.modelValue, open => { if (open) void settingsStore.initialize(); });

const fontOptions: Array<{ value: FontFamily; label: string }> = [
  { value: 'pretendard', label: 'Pretendard' },
  { value: 'kopub-batang', label: 'KoPub 바탕' },
  { value: 'ridi-batang', label: '리디바탕' },
];
const themeOptions: Array<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
  { value: 'system', label: '시스템' },
];
const fontWeightOptions: Array<{ value: FontWeight; label: string }> = [
  { value: 'normal', label: '보통' },
  { value: 'medium', label: '중간' },
  { value: 'bold', label: '굵게' },
];
const textAlignOptions: Array<{ value: TextAlign; label: string }> = [
  { value: 'left', label: '왼쪽' },
  { value: 'justify', label: '양쪽' },
];
const readingOptions = [
  { value: 'showVerseNumbers', label: '절 번호 표시' },
  { value: 'verseJoining', label: '절 붙임 (통독 모드)' },
  { value: 'tongdokAutoComplete', label: '통독모드 자동 완료' },
  { value: 'showDescription', label: '시편 머리말 (새한글)' },
  { value: 'showCrossRef', label: '교차 참조 (새한글)' },
  { value: 'showFootnotes', label: '각주 (새한글)' },
] as const;

const previewStyles = computed(() => ({
  fontFamily: FONT_FAMILIES[settings.value.fontFamily].css,
  fontSize: `${settings.value.fontSize}px`,
  fontWeight: FONT_WEIGHTS[settings.value.fontWeight],
  lineHeight: settings.value.lineHeight,
  textAlign: settings.value.textAlign,
}));

const updateSetting = <K extends keyof typeof settings.value>(key: K, value: typeof settings.value[K]) => {
  settingsStore.updateSetting(key, value);
};

const deleteAllBookmarks = async () => {
  if (!auth.isAuthenticated.value) {
    toast.error('로그인이 필요합니다');
    return;
  }
  const confirmed = await modal.confirm({
    title: '북마크 전체 삭제',
    description: '모든 북마크를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    confirmText: '삭제',
    cancelText: '취소',
    confirmVariant: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;
  isDeleting.value = true;
  try {
    await api.DELETE('/api/v1/todos/bible/bookmarks/delete-all/');
    toast.success('북마크가 모두 삭제되었습니다');
  } catch (error) {
    handleApiError(error, '북마크 삭제');
  } finally {
    isDeleting.value = false;
  }
};

const deleteAllNotes = async () => {
  if (!auth.isAuthenticated.value) {
    toast.error('로그인이 필요합니다');
    return;
  }
  const confirmed = await modal.confirm({
    title: '노트 전체 삭제',
    description: '모든 노트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    confirmText: '삭제',
    cancelText: '취소',
    confirmVariant: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;
  isDeleting.value = true;
  try {
    await api.DELETE('/api/v1/todos/bible/notes/delete-all/');
    toast.success('노트가 모두 삭제되었습니다');
  } catch (error) {
    handleApiError(error, '노트 삭제');
  } finally {
    isDeleting.value = false;
  }
};

const deleteAllHighlights = async () => {
  if (!auth.isAuthenticated.value) {
    toast.error('로그인이 필요합니다');
    return;
  }
  const confirmed = await modal.confirm({
    title: '하이라이트 전체 삭제',
    description: '모든 하이라이트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    confirmText: '삭제',
    cancelText: '취소',
    confirmVariant: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;
  isDeleting.value = true;
  try {
    await api.DELETE('/api/v1/todos/bible/highlights/delete-all/');
    toast.success('하이라이트가 모두 삭제되었습니다');
  } catch (error) {
    handleApiError(error, '하이라이트 삭제');
  } finally {
    isDeleting.value = false;
  }
};

const resetAllSettings = async () => {
  const confirmed = await modal.confirm({
    title: '설정 초기화',
    description: '모든 설정을 기본값으로 초기화하시겠습니까?',
    confirmText: '초기화',
    cancelText: '취소',
    confirmVariant: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;
  settingsStore.resetToDefaults();
  toast.success('설정이 초기화되었습니다');
};
</script>

<style scoped>
.preview-section { padding: 16px 0; color: var(--color-text-primary); }
.preview-label { font-size: 12px; font-weight: 600; color: var(--color-text-tertiary); }
.preview-section h3 { margin: 12px 0 20px; font-size: 22px; font-weight: 700; letter-spacing: var(--tracking-display); }
.preview-verse { display: flex; gap: 10px; margin: 0 0 16px; }
.verse-paragraph { margin: 0; }
.verse-number { flex: 0 0 18px; font-family: var(--font-sans); font-size: 12px; font-weight: 600; color: var(--color-accent-primary); text-align: right; }
.highlight-names .bible-name { color: var(--color-accent-primary); font-weight: 700; }
:global(.reading-settings-sheet .bottom-sheet__handle) { width: 36px; }
:global(.reading-settings-sheet .bottom-sheet__close) { display: none; }
:global(.reading-settings-sheet) { border-radius: 24px 24px 0 0; }
.sync-error { color: var(--color-error); font-size: 13px; }
.quick-links { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; }
.quick-links a { display: inline-flex; align-items: center; min-height: 44px; color: var(--color-accent-primary); }
.done-btn { margin-left: auto; font-size: 14px; font-weight: 600; color: var(--color-accent-primary); }
.settings-section { margin-bottom: 20px; }
.section-title { margin: 0 0 10px; font-size: 13px; font-weight: 600; color: var(--color-text-secondary); }
.font-options, .chip-buttons { display: flex; gap: 8px; }
.font-button, .chip-btn { flex: 1; min-width: 0; min-height: 44px; padding: 8px 4px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-card); color: var(--color-text-secondary); font-size: 13px; cursor: pointer; transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.font-button.active, .chip-btn[aria-pressed="true"] { background: var(--color-accent-primary-light); border-color: var(--color-accent-primary); color: var(--color-accent-primary); }
.font-button:hover, .chip-btn:hover { border-color: var(--color-accent-primary); }
.slider-group { display: grid; gap: 8px; margin-bottom: 12px; }
.slider-row { display: grid; grid-template-columns: 1fr auto; align-items: center; }
.slider-row label { font-size: 13px; font-weight: 600; color: var(--color-text-secondary); }
.slider-row output { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--color-accent-primary); }
.slider-row input { grid-column: 1 / -1; width: 100%; height: 44px; margin: 0; appearance: none; background: transparent; cursor: pointer; accent-color: var(--color-accent-primary); }
.slider-row input::-webkit-slider-runnable-track { height: 4px; border-radius: var(--radius-pill); background: var(--color-border-default); }
.slider-row input::-moz-range-track { height: 4px; border-radius: var(--radius-pill); background: var(--color-border-default); }
.slider-row input::-webkit-slider-thumb { appearance: none; width: 20px; height: 20px; margin-top: -8px; border-radius: 50%; background: var(--color-accent-primary); box-shadow: var(--shadow-sm); }
.slider-row input::-moz-range-thumb { width: 20px; height: 20px; border: none; border-radius: 50%; background: var(--color-accent-primary); box-shadow: var(--shadow-sm); }
.toggle-item { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 56px; }
.name-toggle { border-top: 1px solid var(--color-border-default); padding-top: 12px; }
.toggle-title { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
.switch-hit { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; padding: 0; border: 1px solid transparent; border-radius: var(--radius-pill); background: transparent; cursor: pointer; }
.switch-track { display: block; width: 40px; height: 24px; padding: 3px; box-sizing: border-box; border-radius: var(--radius-pill); background: var(--color-border-default); transition: background-color var(--duration-micro) ease; }
.switch-thumb { display: block; width: 18px; height: 18px; border-radius: 50%; background: var(--color-bg-card); box-shadow: var(--shadow-sm); transition: transform var(--duration-micro) ease; }
.switch-hit[aria-checked="true"] .switch-track { background: var(--color-accent-primary); }
.switch-hit[aria-checked="true"] .switch-thumb { transform: translateX(16px); }
.switch-hit:hover { background: var(--color-bg-hover); }
.advanced-settings { margin-top: 8px; }
.advanced-settings summary { display: list-item; min-height: 44px; padding: 12px 0; box-sizing: border-box; cursor: pointer; font-size: 12px; color: var(--color-text-tertiary); }
.advanced-settings summary:hover { color: var(--color-accent-primary); }
.advanced-settings[open] summary { margin-bottom: 12px; }
.danger-section { margin-top: 20px; }
.danger-section p { font-size: 12px; color: var(--color-error); }
.danger-buttons { display: grid; gap: 8px; }
.font-button:focus-visible, .chip-btn:focus-visible, .slider-row input:focus-visible, .switch-hit:focus-visible, summary:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.font-button:active, .chip-btn:active { transform: scale(.97); }
[data-theme="dark"] .font-button.active, [data-theme="dark"] .chip-btn[aria-pressed="true"] { background: var(--color-bg-card); border: 1.5px solid var(--color-accent-primary); }
@media (prefers-reduced-motion: reduce) {
  .font-button, .chip-btn, .switch-track, .switch-thumb { transition: none; }
  .font-button:active, .chip-btn:active { transform: none; }
}
</style>
