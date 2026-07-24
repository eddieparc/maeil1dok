<template>
  <UiModalBaseModal
    :model-value="isOpen"
    title="읽기 설정"
    size="md"
    position="bottom"
    :no-padding="true"
    @update:model-value="handleModelValueUpdate"
    @close="close"
  >
    <!-- Preview Area -->
    <div class="settings-preview" :class="{ 'loading': isFontLoading }" :style="previewContainerStyles">
      <!-- Font loading overlay -->
      <div v-if="isFontLoading" class="preview-loading">
        <div class="loading-spinner"></div>
      </div>

      <!-- Section Title (System font, not reading font) -->
      <h4 class="preview-section-title">
        예수 그리스도의 계보<span class="reference">(눅 3:23-38)</span>
      </h4>

      <!-- Verses (Reading font) -->
      <div
        class="preview-verses"
        :class="{ 'verse-joining': settings.verseJoining }"
        :style="previewTextStyles"
      >
        <template v-if="settings.verseJoining">
          <!-- Verse joining mode: inline -->
          <p class="verse-paragraph">
            <sup class="verse-num-inline">1</sup><span :class="nameClass">아브라함</span>과 <span :class="nameClass">다윗</span>의 자손 <span :class="nameClass">예수 그리스도</span>의 계보라
            <sup class="verse-num-inline">2</sup><span :class="nameClass">아브라함</span>이 <span :class="nameClass">이삭</span>을 낳고 <span :class="nameClass">이삭</span>은 <span :class="nameClass">야곱</span>을 낳고 <span :class="nameClass">야곱</span>은 <span :class="placeClass">유다</span>와 그의 형제들을 낳고
          </p>
        </template>
        <template v-else>
          <!-- Normal mode: line by line -->
          <p class="preview-verse">
            <span class="verse-number">1</span>
            <span class="verse-text"><span :class="nameClass">아브라함</span>과 <span :class="nameClass">다윗</span>의 자손 <span :class="nameClass">예수 그리스도</span>의 계보라</span>
          </p>
          <p class="preview-verse">
            <span class="verse-number">2</span>
            <span class="verse-text"><span :class="nameClass">아브라함</span>이 <span :class="nameClass">이삭</span>을 낳고 <span :class="nameClass">이삭</span>은 <span :class="nameClass">야곱</span>을 낳고</span>
          </p>
          <p class="preview-verse">
            <span class="verse-number">3</span>
            <span class="verse-text"><span :class="nameClass">야곱</span>은 <span :class="placeClass">유다</span>와 그의 형제들을 낳고</span>
          </p>
        </template>
      </div>
    </div>

    <!-- Settings Body (Scrollable) -->
    <div class="settings-body">
      <!-- Section 1: Theme (Always expanded, compact) -->
      <section class="settings-section theme-section">
        <div class="theme-row">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            class="theme-chip"
            :class="{ active: settings.theme === option.value }"
            @click="updateSetting('theme', option.value)"
          >
            <span class="theme-icon" v-html="option.icon"></span>
            <span>{{ option.label }}</span>
          </button>
        </div>
      </section>

      <!-- Section 2: Typography (Collapsible) -->
      <section class="settings-section">
        <button class="section-header" :aria-expanded="expandedSections.typography" @click="toggleSection('typography')">
          <span class="section-title-text">글꼴 설정</span>
          <span class="section-summary" v-if="!expandedSections.typography">
            {{ fontFamilies[settings.fontFamily].name }} · {{ settings.fontSize }}px · {{ settings.lineHeight.toFixed(1) }}
          </span>
          <svg
            class="chevron"
            :class="{ expanded: expandedSections.typography }"
            width="20" height="20" viewBox="0 0 24 24" fill="none"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <Transition name="collapse">
          <div v-if="expandedSections.typography" class="section-content">
            <!-- Font Family -->
            <div class="setting-group">
              <label class="setting-label">글꼴</label>
              <div class="font-grid">
                <button
                  v-for="(font, key) in fontFamilies"
                  :key="key"
                  class="font-button"
                  :class="{ active: settings.fontFamily === key }"
                  @click="handleFontChange(key as FontFamily)"
                >
                  <span class="font-preview" :style="{ fontFamily: font.css }">가</span>
                  <span class="font-name">{{ font.name }}</span>
                </button>
              </div>
            </div>

            <!-- Font Size + Weight (Inline row) -->
            <div class="setting-row">
              <div class="setting-group flex-1">
                <label class="setting-label" for="reading-font-size">크기</label>
                <div class="slider-compact">
                  <span class="slider-icon small" aria-hidden="true">가</span>
                  <input
                    id="reading-font-size"
                    type="range"
                    :value="settings.fontSize"
                    min="14"
                    max="24"
                    step="1"
                    class="font-size-slider"
                    aria-label="글꼴 크기"
                    @input="updateSetting('fontSize', Number(($event.target as HTMLInputElement).value))"
                  />
                  <span class="slider-icon large">가</span>
                  <span class="slider-value">{{ settings.fontSize }}</span>
                </div>
              </div>
            </div>

            <!-- Line Height Slider -->
            <div class="setting-group">
              <label class="setting-label" for="reading-line-height">줄간격</label>
              <div class="slider-compact">
                <span class="slider-icon small" aria-hidden="true">좁</span>
                <input
                  id="reading-line-height"
                  type="range"
                  :value="settings.lineHeight"
                  :min="LINE_HEIGHT_MIN"
                  :max="LINE_HEIGHT_MAX"
                  :step="LINE_HEIGHT_STEP"
                  class="font-size-slider"
                  aria-label="줄 간격"
                  @input="updateSetting('lineHeight', Number(($event.target as HTMLInputElement).value))"
                />
                <span class="slider-icon large">넓</span>
                <span class="slider-value">{{ settings.lineHeight.toFixed(1) }}</span>
              </div>
            </div>

            <!-- Weight + Align (Compact chips) -->
            <div class="setting-chips-row">
              <div class="chip-group">
                <label class="chip-label">두께</label>
                <div class="chip-buttons">
                  <button
                    v-for="option in fontWeightOptions"
                    :key="option.value"
                    class="chip-button"
                    :class="{ active: settings.fontWeight === option.value }"
                    @click="updateSetting('fontWeight', option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
              <div class="chip-group">
                <label class="chip-label">정렬</label>
                <div class="chip-buttons">
                  <button
                    v-for="option in textAlignOptions"
                    :key="option.value"
                    class="chip-button icon-chip"
                    :class="{ active: settings.textAlign === option.value }"
                    @click="updateSetting('textAlign', option.value)"
                  >
                    <span v-html="option.icon"></span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </section>

      <!-- Section 3: Reading Mode (Collapsible) -->
      <section class="settings-section">
        <button class="section-header" :aria-expanded="expandedSections.readingMode" @click="toggleSection('readingMode')">
          <span class="section-title-text">읽기 모드</span>
          <span class="section-summary" v-if="!expandedSections.readingMode">
            {{ settings.verseJoining ? '절 붙임' : '기본' }}{{ settings.highlightNames ? ' · 강조' : '' }}
          </span>
          <svg
            class="chevron"
            :class="{ expanded: expandedSections.readingMode }"
            width="20" height="20" viewBox="0 0 24 24" fill="none"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <Transition name="collapse">
          <div v-if="expandedSections.readingMode" class="section-content">
            <!-- Verse Joining Toggle -->
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="toggle-title">절 붙임 (통독 모드)</span>
                <span class="toggle-desc">절을 문단으로 연결하여 흐름있게 읽기</span>
              </div>
              <label class="switch">
                <input
                  type="checkbox"
                  :checked="settings.verseJoining"
                  @change="updateSetting('verseJoining', ($event.target as HTMLInputElement).checked)"
                />
                <span class="switch-slider"></span>
              </label>
            </div>

            <!-- Highlight Names Toggle -->
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="toggle-title">인명/지명 강조</span>
                <span class="toggle-desc">성경 인물과 지명을 색상으로 구분</span>
              </div>
              <label class="switch">
                <input
                  type="checkbox"
                  :checked="settings.highlightNames"
                  @change="updateSetting('highlightNames', ($event.target as HTMLInputElement).checked)"
                />
                <span class="switch-slider"></span>
              </label>
            </div>

            <!-- KNT specific options -->
            <template v-if="currentVersion === 'KNT'">
              <div class="divider"></div>
              <p class="knt-label">새한글 전용 옵션</p>

              <div class="toggle-row compact">
                <span class="toggle-title">시편 머리말</span>
                <label class="switch small">
                  <input
                    type="checkbox"
                    :checked="settings.showDescription"
                    @change="updateSetting('showDescription', ($event.target as HTMLInputElement).checked)"
                  />
                  <span class="switch-slider"></span>
                </label>
              </div>
              <div class="toggle-row compact">
                <span class="toggle-title">교차 참조</span>
                <label class="switch small">
                  <input
                    type="checkbox"
                    :checked="settings.showCrossRef"
                    @change="updateSetting('showCrossRef', ($event.target as HTMLInputElement).checked)"
                  />
                  <span class="switch-slider"></span>
                </label>
              </div>
              <div class="toggle-row compact">
                <span class="toggle-title">각주</span>
                <label class="switch small">
                  <input
                    type="checkbox"
                    :checked="settings.showFootnotes"
                    @change="updateSetting('showFootnotes', ($event.target as HTMLInputElement).checked)"
                  />
                  <span class="switch-slider"></span>
                </label>
              </div>
            </template>
          </div>
        </Transition>
      </section>
    </div>

    <!-- Quick Links -->
    <div class="quick-links">
      <NuxtLink to="/bible/bookmarks" class="quick-link" @click="close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>북마크</span>
      </NuxtLink>
      <NuxtLink to="/bible/notes" class="quick-link" @click="close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="14,2 14,8 20,8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>노트</span>
      </NuxtLink>
      <NuxtLink to="/bible/highlights" class="quick-link" @click="close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>하이라이트</span>
      </NuxtLink>
      <NuxtLink to="/bible/settings" class="quick-link" @click="close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        <span>전체 설정</span>
      </NuxtLink>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="settings-footer-content">
        <button class="reset-button" @click="resetToDefaults">
          초기화
        </button>
        <button class="save-button" @click="save">
          저장
        </button>
      </div>
    </template>
  </UiModalBaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch, reactive } from 'vue'
import { useReadingSettingsStore, FONT_FAMILIES, FONT_WEIGHTS, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX, LINE_HEIGHT_STEP, type FontFamily, type ThemeMode, type FontWeight, type TextAlign, type ReadingSettings } from '~/stores/readingSettings'

const props = defineProps<{
  isOpen: boolean
  currentVersion: string
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useReadingSettingsStore()

// 로컬 설정 상태 (미리보기용)
const localSettings = ref<ReadingSettings>({ ...store.settings })

// 섹션 확장 상태
const expandedSections = reactive({
  typography: true,
  readingMode: false,
})

// 폰트 로딩 상태
const isFontLoading = ref(false)

// 모달이 열릴 때 현재 설정을 로컬에 복사
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    localSettings.value = { ...store.settings }
    // 열릴 때 typography 섹션 기본 열기
    expandedSections.typography = true
    expandedSections.readingMode = false
  }
})

const settings = computed(() => localSettings.value)

const fontFamilies = FONT_FAMILIES

// 테마 옵션
const themeOptions: Array<{ value: ThemeMode; label: string; icon: string }> = [
  {
    value: 'light',
    label: '라이트',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
  },
  {
    value: 'dark',
    label: '다크',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
  },
  {
    value: 'system',
    label: '자동',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
  },
]

const fontWeightOptions: Array<{ value: FontWeight; label: string }> = [
  { value: 'normal', label: '보통' },
  { value: 'medium', label: '중간' },
  { value: 'bold', label: '굵게' },
]

const textAlignOptions: Array<{ value: TextAlign; icon: string }> = [
  {
    value: 'left',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>'
  },
  {
    value: 'justify',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>'
  },
]

// 테마별 색상 (themes.css와 동일)
const themeColors = {
  light: {
    bg: '#f9fafb',
    text: '#1f2937',
    verseNumber: '#999999',
    sectionTitle: '#4a5d4a',
    highlightName: '#7c5a3c',
    highlightPlace: '#5a6e54',
  },
  dark: {
    bg: '#1a1a1a',
    text: '#e0e0e0',
    verseNumber: '#666666',
    sectionTitle: '#8ba888',
    highlightName: '#c9a67a',
    highlightPlace: '#9cb094',
  },
}

// 현재 테마 설정에 따른 실제 테마 (system 처리)
const effectiveTheme = computed(() => {
  if (settings.value.theme === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  }
  return settings.value.theme
})

// 미리보기 컨테이너 스타일 (배경색)
const previewContainerStyles = computed(() => {
  const colors = themeColors[effectiveTheme.value]
  return {
    backgroundColor: colors.bg,
    '--preview-verse-number': colors.verseNumber,
    '--preview-section-title': colors.sectionTitle,
    '--preview-name-color': colors.highlightName,
    '--preview-place-color': colors.highlightPlace,
  }
})

// 미리보기 텍스트 스타일 (폰트 관련)
const previewTextStyles = computed(() => {
  const colors = themeColors[effectiveTheme.value]
  return {
    fontFamily: FONT_FAMILIES[settings.value.fontFamily].css,
    fontSize: `${settings.value.fontSize}px`,
    fontWeight: FONT_WEIGHTS[settings.value.fontWeight],
    lineHeight: settings.value.lineHeight,
    textAlign: settings.value.textAlign,
    color: colors.text,
  }
})

// 인명/지명 강조 클래스 (토글 상태에 따라)
const nameClass = computed(() => settings.value.highlightNames ? 'bible-name' : '')
const placeClass = computed(() => settings.value.highlightNames ? 'bible-place' : '')

function toggleSection(section: 'typography' | 'readingMode') {
  expandedSections[section] = !expandedSections[section]
}

function updateSetting<K extends keyof ReadingSettings>(key: K, value: ReadingSettings[K]) {
  localSettings.value = { ...localSettings.value, [key]: value }
}

// 폰트 변경 시 로딩 처리
async function handleFontChange(fontKey: FontFamily) {
  const font = FONT_FAMILIES[fontKey]

  // 시스템 폰트는 로딩 필요 없음
  if (fontKey === 'system') {
    updateSetting('fontFamily', fontKey)
    return
  }

  isFontLoading.value = true

  try {
    // 폰트 프리로드 (document.fonts API 사용)
    if (typeof document !== 'undefined' && document.fonts) {
      const fontFace = `${FONT_WEIGHTS[settings.value.fontWeight]} ${settings.value.fontSize}px ${font.css.split(',')[0].replace(/"/g, '')}`
      await document.fonts.load(fontFace)
    }
  } catch (e) {
    // 폰트 로딩 실패해도 계속 진행
    console.warn('Font preload failed:', e)
  }

  updateSetting('fontFamily', fontKey)

  // 최소 로딩 시간 보장 (깜빡임 방지)
  setTimeout(() => {
    isFontLoading.value = false
  }, 150)
}

function resetToDefaults() {
  localSettings.value = {
    theme: 'light',
    fontFamily: 'kopub-batang',
    fontSize: 16,
    fontWeight: 'medium',
    lineHeight: 1.6,
    textAlign: 'left',
    verseJoining: false,
    showVerseNumbers: true,
    tongdokAutoComplete: false,
    showDescription: true,
    showCrossRef: true,
    highlightNames: true,
    showFootnotes: false,
  }
}

function save() {
  store.updateSettings(localSettings.value)
  emit('close')
}

function close() {
  localSettings.value = { ...store.settings }
  emit('close')
}

function handleModelValueUpdate(value: boolean) {
  if (!value) {
    close()
  }
}
</script>

<style scoped>
/* Preview Area */
.settings-preview {
  padding: 16px;
  flex-shrink: 0;
  position: relative;
  transition: opacity 0.15s ease;
  border-radius: 12px;
  margin: 12px 16px;
  border: 1px solid var(--border-color, #e5e7eb);
}

.settings-preview.loading {
  opacity: 0.6;
}

.preview-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color, #e5e7eb);
  border-top-color: var(--accent-primary, #2A1111);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Section Title in Preview (System font) */
.preview-section-title {
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: var(--preview-section-title, #4a5d4a);
  margin: 0 0 12px 0;
  text-align: center;
}

.preview-section-title .reference {
  font-size: 0.75em;
  font-weight: 500;
  color: #6b7280;
  margin-left: 2px;
}

/* Preview Verses */
.preview-verses {
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.2s ease;
}

.preview-verse {
  margin: 0;
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.preview-verse .verse-number {
  color: var(--preview-verse-number, #999);
  font-family: "Pretendard", sans-serif;
  font-size: 0.7em;
  font-weight: 500;
  min-width: 1em;
  text-align: right;
  flex-shrink: 0;
  line-height: 2;
}

.preview-verse .verse-text {
  flex: 1;
}

/* Verse Joining Mode */
.preview-verses.verse-joining {
  gap: 0;
}

.verse-paragraph {
  margin: 0;
  text-indent: 0;
}

.verse-num-inline {
  font-size: 0.6em;
  color: var(--preview-verse-number, #999);
  font-family: "Pretendard", sans-serif;
  font-weight: 500;
  vertical-align: super;
  margin-right: 0.1em;
}

/* Name/Place Highlighting */
.bible-name {
  color: var(--preview-name-color, #7c5a3c);
}

.bible-place {
  color: var(--preview-place-color, #5a6e54);
}

/* Settings Body */
.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.settings-section {
  border-bottom: 1px solid var(--border-light, #f0f0f0);
}

.settings-section:last-child {
  border-bottom: none;
}

/* Theme Section (Compact) */
.theme-section {
  padding: 12px 16px;
}

.theme-row {
  display: flex;
  gap: 8px;
}

.theme-chip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1.5px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  background: var(--bg-secondary, #fff);
  color: var(--text-primary, #2a1111);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  font-weight: 500;
}

.theme-chip:hover {
  border-color: var(--accent-primary, #2A1111);
}

.theme-chip.active {
  border-color: var(--accent-primary, #2A1111);
  background: var(--accent-primary-light, #e9f5f0);
  color: var(--accent-primary, #2A1111);
}

.theme-icon {
  display: flex;
  align-items: center;
}

/* Section Header (Collapsible) */
.section-header {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  gap: 8px;
}

.section-title-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #2a1111);
}

.section-summary {
  flex: 1;
  font-size: 13px;
  color: var(--text-tertiary, #888);
  text-align: right;
  margin-right: 4px;
}

.chevron {
  color: var(--text-tertiary, #888);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.chevron.expanded {
  transform: rotate(180deg);
}

/* Section Content */
.section-content {
  padding: 0 16px 16px;
}

.setting-group {
  margin-bottom: 16px;
}

.setting-group:last-child {
  margin-bottom: 0;
}

.setting-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #666);
  margin-bottom: 8px;
}

/* Font Grid */
.font-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.font-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  border: 1.5px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  background: var(--bg-secondary, #fff);
  color: var(--text-primary, #2a1111);
  cursor: pointer;
  transition: all 0.2s;
}

.font-button:hover {
  border-color: var(--accent-primary, #2A1111);
}

.font-button.active {
  border-color: var(--accent-primary, #2A1111);
  background: var(--accent-primary-light, #e9f5f0);
}

.font-preview {
  font-size: 22px;
  line-height: 1.2;
}

.font-name {
  font-size: 10px;
  font-weight: 500;
  text-align: center;
  line-height: 1.2;
}

/* Slider Compact */
.setting-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.flex-1 {
  flex: 1;
}

.slider-compact {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-icon {
  color: var(--text-tertiary, #888);
}

.slider-icon.small {
  font-size: 12px;
}

.slider-icon.large {
  font-size: 18px;
}

.font-size-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border-color, #e5e7eb);
  border-radius: 2px;
  outline: none;
}

.font-size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-primary, #2A1111);
  cursor: pointer;
}

.font-size-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-primary, #2A1111);
  cursor: pointer;
  border: none;
}

.slider-value {
  min-width: 28px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-primary, #2A1111);
}

/* Chip Buttons Row */
.setting-chips-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.chip-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chip-label {
  font-size: 11px;
  color: var(--text-tertiary, #888);
}

.chip-buttons {
  display: flex;
  gap: 4px;
}

.chip-button {
  padding: 6px 10px;
  border: 1.5px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  background: var(--bg-secondary, #fff);
  color: var(--text-primary, #2a1111);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 12px;
  font-weight: 500;
}

.chip-button:hover {
  border-color: var(--accent-primary, #2A1111);
}

.chip-button.active {
  border-color: var(--accent-primary, #2A1111);
  background: var(--accent-primary, #2A1111);
  color: white;
}

.chip-button.icon-chip {
  padding: 6px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Toggle Row */
.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}

.toggle-row.compact {
  padding: 6px 0;
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #2a1111);
}

.toggle-desc {
  font-size: 12px;
  color: var(--text-tertiary, #888);
}

/* Switch Toggle */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 26px;
  flex-shrink: 0;
}

.switch.small {
  width: 36px;
  height: 22px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-color, #e5e7eb);
  transition: 0.2s;
  border-radius: 26px;
}

.switch-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.switch.small .switch-slider:before {
  height: 16px;
  width: 16px;
}

.switch input:checked + .switch-slider {
  background-color: var(--accent-primary, #2A1111);
}

.switch input:checked + .switch-slider:before {
  transform: translateX(18px);
}

.switch.small input:checked + .switch-slider:before {
  transform: translateX(14px);
}

/* KNT Options */
.divider {
  height: 1px;
  background: var(--border-light, #f0f0f0);
  margin: 12px 0;
}

.knt-label {
  font-size: 11px;
  color: var(--text-tertiary, #888);
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Quick Links */
.quick-links {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-light, #f0f0f0);
  flex-shrink: 0;
}

.quick-link {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  background: var(--bg-secondary, #f9fafb);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  color: var(--text-secondary, #666);
  font-size: 11px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
}

.quick-link:hover {
  background: var(--accent-primary-light, #e9f5f0);
  border-color: var(--accent-primary, #2A1111);
  color: var(--accent-primary, #2A1111);
}

.quick-link:active {
  transform: scale(0.97);
}

.quick-link svg {
  opacity: 0.7;
}

.quick-link:hover svg {
  opacity: 1;
}

/* Footer */
.settings-footer-content {
  display: flex;
  gap: 8px;
}

.reset-button {
  padding: 12px 16px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary, #666);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.reset-button:hover {
  background: var(--button-bg, #f3f4f6);
}

.save-button {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: var(--accent-primary, #2A1111);
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.save-button:hover {
  background: var(--color-accent-primary-hover, #3A1A1A);
}

/* Collapse Transition */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
