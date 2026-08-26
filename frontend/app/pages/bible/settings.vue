<template>
  <div class="bible-page settings-page">
    <header class="bible-page-header">
      <button class="bible-back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <h1>읽기 설정</h1>
      <button 
        class="save-btn" 
        :class="{ saving: isSaving, inactive: !hasChanges && !isSaving }"
        :disabled="isSaving || !hasChanges"
        @click="saveSettings"
      >
        <template v-if="isSaving">
          <span class="save-spinner"></span>
          저장 중
        </template>
        <template v-else>
          저장
        </template>
      </button>
    </header>

    <div class="settings-content">
      <!-- 미리보기 (상단 고정) -->
      <section class="preview-section">
        <div class="preview-header">
          <span class="preview-label">미리보기</span>
        </div>
        <div class="preview-content" :style="previewStyles">
          <template v-if="settings.verseJoining">
            <p class="verse-paragraph">
              <sup class="verse-sup">1</sup>태초에 하나님이 천지를 창조하시니라
              <sup class="verse-sup">2</sup>땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 하나님의 영은 수면 위에 운행하시니라
            </p>
          </template>
          <template v-else>
            <div class="preview-verse">
              <span v-if="settings.showVerseNumbers" class="verse-number">1</span>
              <span class="verse-text">태초에 하나님이 천지를 창조하시니라</span>
            </div>
            <div class="preview-verse">
              <span v-if="settings.showVerseNumbers" class="verse-number">2</span>
              <span class="verse-text">땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 하나님의 영은 수면 위에 운행하시니라</span>
            </div>
          </template>
        </div>
      </section>

      <!-- 테마 설정 -->
      <section class="settings-section">
        <h2 class="section-title">테마</h2>
        <div class="theme-selector">
          <button
            v-for="theme in themeOptions"
            :key="theme.value"
            class="theme-btn"
            :class="{ active: settings.theme === theme.value }"
            @click="updateSetting('theme', theme.value)"
          >
            <span class="theme-icon" v-html="theme.icon"></span>
            <span>{{ theme.label }}</span>
          </button>
        </div>
      </section>

      <!-- 글꼴 설정 -->
      <section class="settings-section">
        <h2 class="section-title">글꼴</h2>
        
        <!-- 글꼴 선택 (좌우 스크롤) -->
        <div class="font-scroll-container">
          <div class="font-scroll">
            <button
              v-for="fontKey in fontFamilyOrder"
              :key="fontKey"
              class="font-button"
              :class="{ active: settings.fontFamily === fontKey }"
              :style="{ fontFamily: fontFamilies[fontKey].css }"
              @click="updateSetting('fontFamily', fontKey)"
            >
              {{ fontFamilies[fontKey].name }}
            </button>
          </div>
        </div>

        <!-- 크기 & 줄간격 슬라이더 -->
        <div class="slider-group">
          <div class="slider-row">
            <span class="slider-label">크기</span>
            <div class="slider-control">
              <span class="slider-icon small">가</span>
              <input
                type="range"
                :value="settings.fontSize"
                min="14"
                max="24"
                step="1"
                class="slider"
                @input="updateSetting('fontSize', Number(($event.target as HTMLInputElement).value))"
              />
              <span class="slider-icon large">가</span>
              <span class="slider-value">{{ settings.fontSize }}</span>
            </div>
          </div>
          
          <div class="slider-row">
            <span class="slider-label">줄간격</span>
            <div class="slider-control">
              <span class="slider-icon-text">좁게</span>
              <input
                type="range"
                :value="settings.lineHeight"
                :min="LINE_HEIGHT_MIN"
                :max="LINE_HEIGHT_MAX"
                :step="LINE_HEIGHT_STEP"
                class="slider"
                @input="updateSetting('lineHeight', Number(($event.target as HTMLInputElement).value))"
              />
              <span class="slider-icon-text">넓게</span>
              <span class="slider-value">{{ settings.lineHeight.toFixed(1) }}</span>
            </div>
          </div>
        </div>

        <!-- 두께 & 정렬 -->
        <div class="inline-options">
          <div class="inline-option-group">
            <span class="option-label">두께</span>
            <div class="chip-buttons weight-buttons">
              <button
                v-for="option in fontWeightOptions"
                :key="option.value"
                class="chip-btn weight-chip"
                :class="{ active: settings.fontWeight === option.value }"
                @click="updateSetting('fontWeight', option.value)"
              >
                <span 
                  class="weight-preview"
                  :style="{
                    fontFamily: FONT_FAMILIES[settings.fontFamily].css,
                    fontWeight: FONT_WEIGHTS[option.value]
                  }"
                >
                  {{ option.label }}
                </span>
              </button>
            </div>
          </div>
          <div class="inline-option-group">
            <span class="option-label">정렬</span>
            <div class="chip-buttons">
              <button
                v-for="option in textAlignOptions"
                :key="option.value"
                class="chip-btn"
                :class="{ active: settings.textAlign === option.value }"
                @click="updateSetting('textAlign', option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 읽기 옵션 -->
      <section class="settings-section">
        <h2 class="section-title">읽기 옵션</h2>
        
        <div class="toggle-item">
          <div class="toggle-info">
            <span class="toggle-title">절 번호 표시</span>
          </div>
          <label class="toggle">
            <input
              type="checkbox"
              :checked="settings.showVerseNumbers"
              @change="updateSetting('showVerseNumbers', ($event.target as HTMLInputElement).checked)"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="toggle-item">
          <div class="toggle-info">
            <span class="toggle-title">절 붙임 (통독 모드)</span>
            <span class="toggle-desc">절을 문단으로 연결하여 흐름있게 읽기</span>
          </div>
          <label class="toggle">
            <input
              type="checkbox"
              :checked="settings.verseJoining"
              @change="updateSetting('verseJoining', ($event.target as HTMLInputElement).checked)"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="toggle-item">
          <div class="toggle-info">
            <span class="toggle-title">인명/지명 강조</span>
            <span class="toggle-desc">성경 인물과 지명을 색상으로 구분</span>
          </div>
          <label class="toggle">
            <input
              type="checkbox"
              :checked="settings.highlightNames"
              @change="updateSetting('highlightNames', ($event.target as HTMLInputElement).checked)"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </section>

      <!-- 통독 설정 -->
      <section class="settings-section">
        <h2 class="section-title">통독 설정</h2>

        <div class="toggle-item">
          <div class="toggle-info">
            <span class="toggle-title">통독모드 자동 완료</span>
            <span class="toggle-desc">마지막 장을 넘길 때 자동으로 완료 처리</span>
          </div>
          <label class="toggle">
            <input
              type="checkbox"
              :checked="settings.tongdokAutoComplete"
              @change="updateSetting('tongdokAutoComplete', ($event.target as HTMLInputElement).checked)"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </section>

      <!-- 데이터 관리 -->
      <section class="settings-section danger-section">
        <h2 class="section-title danger">데이터 관리</h2>
        <p class="danger-hint">아래 작업은 되돌릴 수 없습니다.</p>

        <div class="danger-buttons">
          <button class="danger-btn" :disabled="isDeleting" @click="deleteAllBookmarks">
            북마크 전체 삭제
          </button>
          <button class="danger-btn" :disabled="isDeleting" @click="deleteAllNotes">
            노트 전체 삭제
          </button>
          <button class="danger-btn" :disabled="isDeleting" @click="deleteAllHighlights">
            하이라이트 전체 삭제
          </button>
          <button class="danger-btn reset" :disabled="isDeleting" @click="resetAllSettings">
            모든 설정 초기화
          </button>
        </div>
      </section>
    </div>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  useReadingSettingsStore, 
  FONT_FAMILIES, 
  FONT_FAMILY_ORDER,
  FONT_WEIGHTS,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_STEP,
  type ThemeMode, 
  type FontWeight, 
  type TextAlign 
} from '~/stores/readingSettings';
import { useAuthService } from '~/composables/useAuthService';
import { useApi } from '~/composables/useApi';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useModal } from '~/composables/useModal';
import { useToast } from '~/composables/useToast';
import Toast from '~/components/Toast.vue';

definePageMeta({
  layout: 'default'
});

const router = useRouter();
const settingsStore = useReadingSettingsStore();
const auth = useAuthService();
const api = useApi();
const toast = useToast();
const modal = useModal();
const { handleApiError } = useErrorHandler();

const isDeleting = ref(false);
const isSaving = ref(false);

const settings = computed(() => settingsStore.settings);

// 저장된 설정 (서버 상태) 추적
const savedSettings = ref<string>('');

// 변경사항 감지
const hasChanges = computed(() => {
  if (!savedSettings.value) return false;
  return JSON.stringify(settings.value) !== savedSettings.value;
});

// 페이지 로드 시 현재 설정을 저장된 상태로 기록
onMounted(() => {
  savedSettings.value = JSON.stringify(settings.value);
});

// 저장 버튼 클릭
const saveSettings = async () => {
  if (!auth.isAuthenticated.value) {
    toast.info('로그인하면 설정이 서버에 저장됩니다');
    return;
  }
  
  if (!hasChanges.value) return;
  
  isSaving.value = true;
  try {
    await settingsStore.syncToServer();
    savedSettings.value = JSON.stringify(settings.value);
    toast.success('저장되었습니다');
  } catch (error) {
    toast.error('저장에 실패했습니다');
  } finally {
    isSaving.value = false;
  }
};

const fontFamilies = FONT_FAMILIES;
const fontFamilyOrder = FONT_FAMILY_ORDER;

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
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
  },
];

// 글꼴 두께 옵션
const fontWeightOptions: Array<{ value: FontWeight; label: string }> = [
  { value: 'normal', label: '보통' },
  { value: 'medium', label: '중간' },
  { value: 'bold', label: '굵게' },
];

// 텍스트 정렬 옵션
const textAlignOptions: Array<{ value: TextAlign; label: string }> = [
  { value: 'left', label: '왼쪽' },
  { value: 'justify', label: '양쪽' },
];

// 미리보기 스타일
const previewStyles = computed(() => ({
  fontFamily: FONT_FAMILIES[settings.value.fontFamily].css,
  fontSize: `${settings.value.fontSize}px`,
  fontWeight: FONT_WEIGHTS[settings.value.fontWeight],
  lineHeight: settings.value.lineHeight,
  textAlign: settings.value.textAlign,
}));

// 네비게이션
const goBack = () => {
  router.back();
};



// 설정 업데이트
const updateSetting = <K extends keyof typeof settings.value>(key: K, value: typeof settings.value[K]) => {
  settingsStore.updateSetting(key, value);
};

// 북마크 전체 삭제
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

// 노트 전체 삭제
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

// 하이라이트 전체 삭제
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

// 설정 초기화
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
/* 헤더 */
.bible-page-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border-default);
  position: sticky;
  top: 0;
  z-index: 10;
}

.bible-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.bible-back-btn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* 저장 버튼 */
.save-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.875rem;
  background-color: var(--color-accent-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 70px;
  justify-content: center;
}

.save-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.save-btn:disabled {
  cursor: not-allowed;
}

.save-btn.saving {
  background-color: var(--color-text-muted);
}

.save-btn.inactive {
  background-color: var(--color-border-default);
  color: var(--color-text-muted);
  cursor: default;
}

.save-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.bible-page-header h1 {
  flex: 1;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

/* 설정 컨텐츠 */
.settings-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 2rem;
}

/* 미리보기 섹션 */
.preview-section {
  background-color: var(--color-bg-card);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.preview-header {
  padding: 0.5rem 1rem;
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-default);
}

.preview-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-content {
  padding: 1rem;
  color: var(--color-text-primary);
  min-height: 80px;
}

.preview-verse {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.preview-verse:last-child {
  margin-bottom: 0;
}

.verse-number {
  font-size: 0.7em;
  color: var(--color-text-muted);
  font-weight: 500;
  min-width: 1.25em;
  text-align: right;
  flex-shrink: 0;
  line-height: 2;
  font-family: system-ui, sans-serif;
}

.verse-text {
  flex: 1;
}

.verse-paragraph {
  margin: 0;
}

.verse-sup {
  font-size: 0.6em;
  color: var(--color-text-muted);
  font-family: system-ui, sans-serif;
  vertical-align: super;
  margin-right: 0.15em;
}

/* 섹션 공통 */
.settings-section {
  background-color: var(--color-bg-card);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: var(--shadow-sm);
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 1rem;
}

.section-title.danger {
  color: var(--color-error);
}

/* 폰트 스크롤 */
.font-scroll-container {
  margin: 0 -1rem;
  margin-bottom: 1rem;
}

.font-scroll {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.25rem 1rem;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.font-scroll::-webkit-scrollbar {
  display: none;
}

.font-button {
  flex-shrink: 0;
  padding: 0.625rem 1rem;
  border: 1.5px solid var(--color-border-default);
  border-radius: 10px;
  background-color: var(--color-bg-card);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9375rem;
  white-space: nowrap;
}

.font-button:hover {
  border-color: var(--color-accent-primary);
}

.font-button.active {
  border-color: var(--color-accent-primary);
  background-color: var(--color-accent-primary-light);
  color: var(--color-accent-primary);
}

/* 슬라이더 그룹 */
.slider-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: var(--color-bg-secondary);
  border-radius: 10px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.slider-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  min-width: 48px;
}

.slider-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.slider-icon {
  color: var(--color-text-muted);
}

.slider-icon.small {
  font-size: 0.75rem;
}

.slider-icon.large {
  font-size: 1.125rem;
}

.slider-icon-text {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background-color: var(--color-border-default);
  border-radius: 2px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--color-accent-primary);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--color-accent-primary);
  cursor: pointer;
  border: none;
}

.slider-value {
  min-width: 28px;
  text-align: right;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-accent-primary);
}

/* 인라인 옵션 */
.inline-options {
  display: flex;
  gap: 1rem;
}

.inline-option-group {
  flex: 1;
}

.option-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 0.375rem;
}

.chip-buttons {
  display: flex;
  gap: 0.25rem;
}

.chip-btn {
  flex: 1;
  padding: 0.5rem 0.5rem;
  border: 1.5px solid var(--color-border-default);
  border-radius: 6px;
  background-color: var(--color-bg-card);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.8125rem;
  font-weight: 500;
}

.chip-btn:hover {
  border-color: var(--color-accent-primary);
}

.chip-btn.active {
  border-color: var(--color-accent-primary);
  background-color: var(--color-accent-primary);
  color: var(--color-text-inverse);
}

/* 두께 버튼 */
.weight-buttons {
  gap: 0.375rem;
}

.weight-chip {
  padding: 0.375rem 0.25rem;
}

.weight-preview {
  font-size: 0.9375rem;
  line-height: 1.2;
}

/* 테마 선택 */
.theme-selector {
  display: flex;
  gap: 0.5rem;
}

.theme-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.75rem;
  border: 1.5px solid var(--color-border-default);
  border-radius: 10px;
  background-color: var(--color-bg-card);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.8125rem;
  font-weight: 500;
}

.theme-btn:hover {
  border-color: var(--color-accent-primary);
}

.theme-btn.active {
  border-color: var(--color-accent-primary);
  background-color: var(--color-accent-primary-light);
  color: var(--color-accent-primary);
}

.theme-icon {
  display: flex;
  align-items: center;
}

/* 토글 아이템 */
.toggle-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--color-border-light);
}

.toggle-item:last-child {
  border-bottom: none;
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.toggle-title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.toggle-desc {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* 토글 스위치 */
.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 26px;
  flex-shrink: 0;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-border-default);
  transition: 0.2s;
  border-radius: 26px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
}

.toggle input:checked + .toggle-slider {
  background-color: var(--color-accent-primary);
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(18px);
}

/* 설정 아이템 */
.setting-item {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border-light);
}

.setting-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.setting-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.375rem;
}

/* 라디오 옵션 */
.radio-options {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.radio-option:hover {
  background-color: var(--color-bg-hover);
}

.radio-option.active {
  background-color: var(--color-accent-primary-light);
}

.radio-option input {
  accent-color: var(--color-accent-primary);
}

.radio-label {
  font-size: 0.9375rem;
  color: var(--color-text-primary);
}

/* 위험 섹션 */
.danger-section {
  border: 1px solid var(--color-error-bg);
}

.danger-hint {
  font-size: 0.75rem;
  color: var(--color-error);
  margin: 0 0 0.75rem;
}

.danger-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.danger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1rem;
  background-color: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.danger-btn:hover:not(:disabled) {
  border-color: var(--color-error);
  background-color: var(--color-error-bg);
  color: var(--color-error);
}

.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.danger-btn.reset {
  border-color: var(--color-error);
  color: var(--color-error);
}

.danger-btn.reset:hover:not(:disabled) {
  background-color: var(--color-error);
  color: var(--color-text-inverse);
}

/* ===== 다크모드 ===== */
[data-theme="dark"] .settings-page {
  background-color: var(--color-bg-primary);
}

/* 헤더 */
[data-theme="dark"] .bible-page-header {
  background-color: var(--color-bg-card);
  border-bottom-color: var(--color-border-default);
}

[data-theme="dark"] .bible-page-header h1 {
  color: var(--color-text-primary);
}

[data-theme="dark"] .bible-back-btn {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .bible-back-btn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

[data-theme="dark"] .save-btn {
  background-color: var(--color-accent-primary);
  color: var(--color-text-inverse);
}

[data-theme="dark"] .save-btn.saving {
  background-color: var(--color-text-muted);
}

[data-theme="dark"] .save-btn.inactive {
  background-color: var(--color-border-dark);
  color: var(--color-text-muted);
}

/* 미리보기 섹션 */
[data-theme="dark"] .preview-section {
  background-color: var(--color-bg-card);
  box-shadow: var(--shadow-sm);
}

[data-theme="dark"] .preview-header {
  background-color: var(--color-bg-tertiary);
  border-bottom-color: var(--color-border-default);
}

[data-theme="dark"] .preview-label {
  color: var(--color-text-muted);
}

[data-theme="dark"] .preview-content {
  color: var(--color-text-primary);
}

[data-theme="dark"] .verse-number,
[data-theme="dark"] .verse-sup {
  color: var(--color-text-muted);
}

/* 섹션 공통 */
[data-theme="dark"] .settings-section {
  background-color: var(--color-bg-card);
  box-shadow: var(--shadow-sm);
}

[data-theme="dark"] .section-title {
  color: var(--color-text-primary);
}

[data-theme="dark"] .section-title.danger {
  color: var(--color-error);
}

/* 폰트 스크롤 */
[data-theme="dark"] .font-button {
  background-color: var(--color-bg-tertiary);
  border-color: var(--color-border-default);
  color: var(--color-text-primary);
}

[data-theme="dark"] .font-button:hover {
  border-color: var(--color-accent-primary);
  background-color: var(--color-bg-hover);
}

[data-theme="dark"] .font-button.active {
  background-color: var(--color-accent-primary-light);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

/* 슬라이더 그룹 */
[data-theme="dark"] .slider-group {
  background-color: var(--color-bg-tertiary);
}

[data-theme="dark"] .slider-label {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .slider-icon,
[data-theme="dark"] .slider-icon-text {
  color: var(--color-text-muted);
}

[data-theme="dark"] .slider {
  background-color: var(--color-border-dark);
}

[data-theme="dark"] .slider::-webkit-slider-thumb {
  background-color: var(--color-accent-primary);
}

[data-theme="dark"] .slider::-moz-range-thumb {
  background-color: var(--color-accent-primary);
}

[data-theme="dark"] .slider-value {
  color: var(--color-accent-primary);
}

/* 인라인 옵션 (두께 & 정렬) */
[data-theme="dark"] .option-label {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .chip-btn {
  background-color: var(--color-bg-tertiary);
  border-color: var(--color-border-default);
  color: var(--color-text-primary);
}

[data-theme="dark"] .chip-btn:hover {
  border-color: var(--color-accent-primary);
  background-color: var(--color-bg-hover);
}

[data-theme="dark"] .chip-btn.active {
  background-color: var(--color-accent-primary-light);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

/* 테마 선택 */
[data-theme="dark"] .theme-btn {
  background-color: var(--color-bg-tertiary);
  border-color: var(--color-border-default);
  color: var(--color-text-primary);
}

[data-theme="dark"] .theme-btn:hover {
  border-color: var(--color-accent-primary);
  background-color: var(--color-bg-hover);
}

[data-theme="dark"] .theme-btn.active {
  background-color: var(--color-accent-primary-light);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

[data-theme="dark"] .theme-icon {
  color: inherit;
}

/* 토글 아이템 */
[data-theme="dark"] .toggle-item {
  border-bottom-color: var(--color-border-light);
}

[data-theme="dark"] .toggle-title {
  color: var(--color-text-primary);
}

[data-theme="dark"] .toggle-desc {
  color: var(--color-text-muted);
}

[data-theme="dark"] .toggle-slider {
  background-color: var(--color-border-dark);
}

[data-theme="dark"] .toggle input:checked + .toggle-slider {
  background-color: var(--color-accent-primary);
}

/* 설정 아이템 */
[data-theme="dark"] .setting-item {
  border-top-color: var(--color-border-light);
}

[data-theme="dark"] .setting-label {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .setting-hint {
  color: var(--color-text-muted);
}

/* 라디오 옵션 */
[data-theme="dark"] .radio-option {
  color: var(--color-text-primary);
}

[data-theme="dark"] .radio-option:hover {
  background-color: var(--color-bg-hover);
}

[data-theme="dark"] .radio-option.active {
  background-color: var(--color-accent-primary-light);
}

[data-theme="dark"] .radio-option input {
  accent-color: var(--color-accent-primary);
}

[data-theme="dark"] .radio-label {
  color: var(--color-text-primary);
}

/* 위험 섹션 */
[data-theme="dark"] .danger-section {
  border-color: rgba(248, 113, 113, 0.3);
}

[data-theme="dark"] .danger-hint {
  color: var(--color-error);
}

[data-theme="dark"] .danger-btn {
  background-color: var(--color-bg-tertiary);
  border-color: var(--color-border-default);
  color: var(--color-text-secondary);
}

[data-theme="dark"] .danger-btn:hover:not(:disabled) {
  border-color: var(--color-error);
  background-color: var(--color-error-bg);
  color: var(--color-error);
}

[data-theme="dark"] .danger-btn.reset {
  border-color: var(--color-error);
  color: var(--color-error);
}

[data-theme="dark"] .danger-btn.reset:hover:not(:disabled) {
  background-color: var(--color-error);
  color: var(--color-text-inverse);
}
</style>
