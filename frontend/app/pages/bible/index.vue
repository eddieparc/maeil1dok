<template>
  <div class="bible-page">
    <!-- 홈/대시보드 뷰 -->
    <BibleHome
      v-if="viewMode === 'home'"
      @continue-reading="handleContinueReading"
      @select-book="handleHomeBookSelect"
      @show-toc="viewMode = 'toc'"
    />

    <!-- 목차 뷰 -->
    <BibleTOC
      v-else-if="viewMode === 'toc'"
      @select-book="handleTocBookSelect"
      @back="handleTocBack"
    />

    <!-- 성경 리더 뷰 -->
    <template v-else>
      <BibleReaderView
        ref="bibleReaderViewRef"
        :content="bibleContent"
        :is-loading="isLoading"
        :scroll-position="scrollPosition"
        :current-book-name="currentBookName"
        :current-chapter="currentChapter"
        :current-version-name="currentVersionName"
        :chapter-suffix="chapterSuffix"
        :has-prev-chapter="hasPrevChapter"
        :has-next-chapter="hasNextChapter"
        :is-tongdok-mode="isTongdokMode"
        :tongdok-schedule-range="tongdokScheduleRange"
        :tongdok-schedule-date="tongdokScheduleDate"
        :tongdok-audio-link="tongdokAudioLink"
        :tongdok-guide-link="tongdokGuideLink"
        :tongdok-progress="tongdokProgress"
        :is-tongdok-audio-player-open="showTongdokAudioPlayer"
        :is-completing="isCompleting"
        :is-current-chapter-read="isCurrentChapterRead"
        :is-marking-read="isMarkingRead"
        :book-progress="currentBookProgress"
        :is-authenticated="auth.isAuthenticated.value"
        :is-bookmarked="isCurrentChapterBookmarked"
        :note-count="currentChapterNoteCount"
        :highlights="chapterHighlights"
        @back="goBack"
        @prev-chapter="goToPrevChapter"
        @next-chapter="goToNextChapter"
        @open-book-selector="showBookSelector = true"
        @open-version-selector="showVersionSelector = true"
        @open-settings="showSettingsModal = true"
        @bookmark-toggle="handleBookmarkToggle"
        @note-click="handleNoteClick"
        @mark-as-read="handleMarkAsRead"
        @scroll="handleScrollPosition"
        @bookmark="handleBookmarkAction"
        @highlight="handleHighlightAction"
        @highlight-delete="handleHighlightDeleteDirect"
        @copy="handleCopyAction"
        @share="handleShareAction"
        @exit-tongdok="handleExitTongdok"
        @tongdok-complete-click="showTongdokCompleteModal = true"
        @today-tongdok="handleTodayTongdok"
        @audio-link-click="handleEmbeddedAudioLink"
        @audio-external-click="handleAudioLink"
        @audio-player-open-change="showTongdokAudioPlayer = $event"
        @audio-ended="handleTongdokAudioEnded"
        @reading-plan-click="showScheduleModal = true"
      />

      <!-- 모달 -->
      <BookSelector
        v-model="showBookSelector"
        :current-book="currentBook"
        :current-chapter="currentChapter"
        :current-version="currentVersion"
        @select="handleBookSelect"
        @version-select="handleVersionSelect"
      />

      <VersionSelector
        v-model="showVersionSelector"
        :current-version="currentVersion"
        @select="handleVersionSelect"
      />

      <!-- 통독 완료 모달 -->
      <TongdokCompleteModal
        v-model="showTongdokCompleteModal"
        :schedule-range="fullTongdokRange"
        :initial-auto-complete="tongdokAutoComplete"
        :is-loading="isCompleting"
        @confirm="handleTongdokComplete"
      />

      <!-- 이미 완료된 통독 일정 모달 -->
      <TongdokAlreadyCompleteModal
        v-model="showAlreadyCompleteModal"
        :schedule-range="fullTongdokRange"
        :is-loading="isCompleting"
        @action="handleAlreadyCompleteAction"
      />

      <!-- 통독 완료 후 다음 일정 이동 모달 -->
      <TongdokNextScheduleModal
        v-model="showNextScheduleModal"
        :schedule-range="fullTongdokRange"
        :is-loading="isCompleting"
        @action="handleNextScheduleAction"
      />

      <!-- 노트 빠른 메모 모달 -->
      <NoteQuickModal
        v-model="showNoteModal"
        :book="currentBook"
        :book-name="currentBookName"
        :chapter="currentChapter"
        :existing-note="currentChapterNote"
        @save="handleNoteSave"
        @go-detail="handleNoteGoDetail"
      />

      <!-- 하이라이트 모달 -->
      <HighlightModal
        v-model="showHighlightModal"
        :book="currentBook"
        :book-name="currentBookName"
        :chapter="currentChapter"
        :start-verse="highlightSelection?.start ?? 1"
        :end-verse="highlightSelection?.end ?? 1"
        :existing-highlight="currentSelectionHighlight"
        :custom-colors="customColors"
        @save="handleHighlightSave"
        @delete="handleHighlightDelete"
        @add-custom-color="handleAddCustomColor"
      />

      <!-- 읽기 설정 모달 -->
      <ReadingSettingsModal
        :is-open="showSettingsModal"
        :current-version="currentVersion"
        @close="showSettingsModal = false"
      />

      <!-- 통독 플랜 선택 모달 -->
      <PlanSelectorModal
        :show="showTongdokPlanModal"
        :subscriptions="subscriptions"
        :selected-plan-id="selectedPlanStore.selectedPlanId"
        @close="showTongdokPlanModal = false"
        @select="handleTongdokPlanSelect"
        @manage="handleTongdokPlanManage"
      />

      <!-- 성경통독표 모달 -->
      <BaseModal
        v-model="showScheduleModal"
        title="성경통독표"
        size="lg"
        :no-padding="true"
      >
        <BibleScheduleContent
          v-if="showScheduleModal"
          :is-modal="true"
          :current-book="currentBook"
          :current-chapter="currentChapter"
          initial-scroll-target="today"
          @schedule-select="handleScheduleSelect"
        />
      </BaseModal>

      <!-- 토스트 -->
      <Toast />

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { LocationQueryValue } from 'vue-router';
// useBibleFetch는 이제 useBibleContent 내부에서 사용됨
import { useTongdokMode } from '~/composables/useTongdokMode';
import { usePersonalRecord } from '~/composables/usePersonalRecord';
import { useReadingPosition } from '~/composables/useReadingPosition';
import { useBookmark } from '~/composables/useBookmark';
import { useNote } from '~/composables/useNote';
import { useHighlight } from '~/composables/useHighlight';
import { useScheduleApi } from '~/composables/useScheduleApi';
import { useBibleModals } from '~/composables/bible/useBibleModals';
import { useBibleContent } from '~/composables/bible/useBibleContent';
import {
  parseVerseRangeParam,
  useBiblePageState,
  type BibleVerseRange,
} from '~/composables/bible/useBiblePageState';
import { useAuthGuard } from '~/composables/useAuthGuard';
import { useAuthService } from '~/composables/useAuthService';
import { useReadingSettingsStore } from '~/stores/readingSettings';
import { useSelectedPlanStore } from '~/stores/selectedPlan';
import { useSubscriptionStore } from '~/stores/subscription';
import { useToast } from '~/composables/useToast';
import { useModal } from '~/composables/useModal';
import { useApi } from '~/composables/useApi';
// 뷰 컴포넌트
import BibleHome from '~/components/bible/BibleHome.vue';
import BibleTOC from '~/components/bible/BibleTOC.vue';
import BibleReaderView from '~/components/bible/BibleReaderView.vue';
import type { SelectionSharePayload } from '~/components/bible/BibleViewer.vue';

// 모달 컴포넌트
import BookSelector from '~/components/bible/BookSelector.vue';
import VersionSelector from '~/components/bible/VersionSelector.vue';
import TongdokCompleteModal from '~/components/bible/TongdokCompleteModal.vue';
import TongdokAlreadyCompleteModal from '~/components/bible/TongdokAlreadyCompleteModal.vue';
import type { AlreadyCompleteAction } from '~/components/bible/TongdokAlreadyCompleteModal.vue';
import TongdokNextScheduleModal from '~/components/bible/TongdokNextScheduleModal.vue';
import type { NextScheduleAction } from '~/components/bible/TongdokNextScheduleModal.vue';
import NoteQuickModal from '~/components/bible/NoteQuickModal.vue';
import HighlightModal from '~/components/bible/HighlightModal.vue';
import ReadingSettingsModal from '~/components/ReadingSettingsModal.vue';
import BibleScheduleContent from '~/components/BibleScheduleContent.vue';
import PlanSelectorModal from '~/components/schedule/PlanSelectorModal.vue';
import BaseModal from '~/components/ui/modal/BaseModal.vue';

// 기타
import Toast from '~/components/Toast.vue';

// 유틸리티
import { getBookCode } from '~/constants/bible';

// 타입
import type { VerseSelection } from '~/types/bible';

definePageMeta({
  layout: 'default'
});

const route = useRoute();
const router = useRouter();
const auth = useAuthService();
const { requireAuth } = useAuthGuard();
const readingSettingsStore = useReadingSettingsStore();
const selectedPlanStore = useSelectedPlanStore();
const subscriptionStore = useSubscriptionStore();
const toast = useToast();
const modal = useModal();
const api = useApi();
const { fetchNextPosition, fetchMonthlySchedules } = useScheduleApi();
const { handleApiError, handleUserActionError } = useErrorHandler();

// Composables
const {
  fetchReadChapters,
  markAsRead,
  isChapterRead,
  getBookProgress,
  isLoading: isMarkingRead
} = usePersonalRecord();
// useBibleFetch는 이제 useBibleContent composable 내부에서 사용됨
const {
  tongdokMode,
  tongdokScheduleId,
  tongdokPlanId,
  isCompleting,
  initTongdokMode,
  getTongdokScheduleRange,
  getFullScheduleRange,
  isLastChapterInTongdok,
  isScheduleCompleted,
  disableTongdokMode,
  enableTongdokMode,
  completeReading,
  setReadingDetailResponse,
  loadReadingDetail,
  getAudioLink,
  getGuideLink,
  getScheduleDate,
  getTongdokProgress,
} = useTongdokMode();
const {
  loadReadingPosition,
  saveReadingPosition,
  restoreScrollPosition: restoreReadingScrollPosition,
  cleanup: cleanupReadingPosition,
  enableSaving: enablePositionSaving,
} = useReadingPosition();
const {
  loadBookmarks,
  isChapterBookmarked,
  toggleChapterBookmark
} = useBookmark();
const {
  currentChapterNotes,
  showNoteModal,
  fetchChapterNotes,
  saveQuickNote,
  getChapterNoteCount
} = useNote();
const {
  chapterHighlights,
  customColors,
  addCustomColor,
  fetchChapterHighlights,
  createHighlight,
  updateHighlight,
  deleteHighlight
} = useHighlight();

// 콘텐츠 로딩 (useBibleContent composable)
const {
  content: bibleContent,
  isLoading,
  loadContent: loadBibleContentFromComposable,
} = useBibleContent();

// 페이지 상태 (useBiblePageState composable)
const {
  viewMode,
  currentBook,
  currentChapter,
  currentVersion,
  currentBookName,
  currentVersionName,
  maxChapters,
  chapterSuffix,
  hasPrevChapter,
  hasNextChapter,
  goBack,
  goToPrevChapter: goToPrevChapterBase,
  goToNextChapter: goToNextChapterBase,
  selectBook,
  selectVersion,
  initFromQuery: initFromQueryBase,
  generateShareUrl,
} = useBiblePageState();

// 모달 상태 (useBibleModals composable로 통합 관리)
const {
  showBookSelector,
  showVersionSelector,
  showTongdokCompleteModal,
  showHighlightModal,
  showSettingsModal,
  highlightSelection,
  openHighlightModal,
  closeTongdokCompleteModal,
} = useBibleModals();

const showAlreadyCompleteModal = ref(false);
const showNextScheduleModal = ref(false);

const ALREADY_COMPLETE_ACTION_KEY = 'tongdokAlreadyCompleteAction';
type SavedAlreadyCompleteAction = 're-complete' | 'go-next' | null;

const getSavedAlreadyCompleteAction = (): SavedAlreadyCompleteAction => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(ALREADY_COMPLETE_ACTION_KEY);
    if (saved === 're-complete' || saved === 'go-next') return saved;
    return null;
  } catch {
    return null;
  }
};

const saveAlreadyCompleteAction = (action: SavedAlreadyCompleteAction): void => {
  if (typeof window === 'undefined') return;
  try {
    if (action) {
      localStorage.setItem(ALREADY_COMPLETE_ACTION_KEY, action);
    } else {
      localStorage.removeItem(ALREADY_COMPLETE_ACTION_KEY);
    }
  } catch {}
};

// 통독 완료 후 다음 일정 이동 모달 관련
const NEXT_SCHEDULE_ACTION_KEY = 'tongdokNextScheduleAction';
type SavedNextScheduleAction = 'go-next-schedule' | null;

const getSavedNextScheduleAction = (): SavedNextScheduleAction => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(NEXT_SCHEDULE_ACTION_KEY);
    if (saved === 'go-next-schedule') return saved;
    return null;
  } catch {
    return null;
  }
};

const saveNextScheduleAction = (action: SavedNextScheduleAction): void => {
  if (typeof window === 'undefined') return;
  try {
    if (action) {
      localStorage.setItem(NEXT_SCHEDULE_ACTION_KEY, action);
    } else {
      localStorage.removeItem(NEXT_SCHEDULE_ACTION_KEY);
    }
  } catch {}
};

// Refs
const bibleReaderViewRef = ref<InstanceType<typeof BibleReaderView> | null>(null);
const scrollPosition = ref(0);
const hasReaderScrollPosition = ref(false);
const pendingVerseFocus = ref<BibleVerseRange | null>(null);
const pendingSearchFocus = ref<string | null>(null);
const showScheduleModal = ref(false);
const showTongdokPlanModal = ref(false);
const showTongdokAudioPlayer = ref(false);

// 페이지 타이틀 동적 설정
const pageTitle = computed(() => {
  if (viewMode.value === 'home') return '성경 | 매일일독';
  if (viewMode.value === 'toc') return '목차 | 매일일독';
  return `${currentBookName.value} ${currentChapter.value}${chapterSuffix.value} | 매일일독`;
});

useHead({
  title: pageTitle,
});

// 구독 목록 (플랜 선택 모달용 - 활성화된 플랜만)
const subscriptions = computed(() => 
  subscriptionStore.activeSubscriptions.map(sub => ({
    plan_id: sub.plan_id,
    plan_name: sub.plan_name,
    is_default: sub.is_default,
  }))
);

// 통독모드 관련
const isTongdokMode = computed(() => tongdokMode.value);
const tongdokScheduleRange = computed(() =>
  getTongdokScheduleRange(currentBook.value, currentChapter.value)
);
const fullTongdokRange = computed(() => getFullScheduleRange());
const isAtLastTongdokChapter = computed(() =>
  isLastChapterInTongdok(currentBook.value, currentChapter.value)
);
const tongdokAutoComplete = computed(() =>
  readingSettingsStore.settings.tongdokAutoComplete
);
const tongdokAudioLink = computed(() => getAudioLink());
const tongdokGuideLink = computed(() => getGuideLink());
const tongdokScheduleDate = computed(() => getScheduleDate());
const tongdokProgress = computed(() =>
  getTongdokProgress(currentBook.value, currentChapter.value)
);

// 읽기모드 관련 (통독모드가 아닐 때)
const isCurrentChapterRead = computed(() =>
  isChapterRead(currentBook.value, currentChapter.value)
);
const currentBookProgress = computed(() =>
  getBookProgress(currentBook.value, maxChapters.value)
);

// 북마크 관련
const isCurrentChapterBookmarked = computed(() =>
  isChapterBookmarked(currentBook.value, currentChapter.value)
);

// 노트 관련
const currentChapterNoteCount = computed(() => getChapterNoteCount());
const currentChapterNote = computed(() =>
  currentChapterNotes.value.find(
    n => n.book === currentBook.value && n.chapter === currentChapter.value
  ) || null
);

// 하이라이트 관련
const currentSelectionHighlight = computed(() => {
  if (!highlightSelection.value) return null;
  return chapterHighlights.value.find(
    h => h.start_verse === highlightSelection.value!.start &&
         h.end_verse === highlightSelection.value!.end
  ) || null;
});

const initFromQuery = () => {
  initFromQueryBase(route.query);
  pendingVerseFocus.value = parseVerseRangeParam(route.query.verse);
  pendingSearchFocus.value = parseSearchFocusParam(route.query.search);
};

// 성경 본문 로드 (composable wrapper)
const loadBibleContent = async (book: string, chapter: number) => {
  await loadBibleContentFromComposable(book, chapter, currentVersion.value);
};

const focusPendingVerseRange = async () => {
  const verseRange = pendingVerseFocus.value;
  if (!verseRange) return;

  await nextTick();
  bibleReaderViewRef.value?.focusVerseRange(verseRange.start, verseRange.end, pendingSearchFocus.value);
};

const parseSearchFocusParam = (value: LocationQueryValue | LocationQueryValue[] | undefined): string | null => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = rawValue?.trim();
  return normalized ? normalized : null;
};

const setReaderScrollPosition = (position: number, fromReaderScroll = false) => {
  scrollPosition.value = position;
  hasReaderScrollPosition.value = fromReaderScroll;
};

const resetReaderScrollPosition = () => {
  setReaderScrollPosition(0);
};

const restoreSavedScrollPosition = async (position: number | undefined) => {
  if (typeof position !== 'number') return;
  setReaderScrollPosition(position);
  await nextTick();
  bibleReaderViewRef.value?.restoreScrollPosition();
  restoreReadingScrollPosition(position);
};

const getExplicitReaderScrollPosition = () => {
  return hasReaderScrollPosition.value ? scrollPosition.value : undefined;
};

// 이벤트 핸들러 (composable wrapper)
// goBack은 useBiblePageState에서 직접 사용

// BookSelector는 (book, chapter, verse) emit
// verse가 있으면 콘텐츠 로드 후 해당 절로 스크롤
const handleBookSelect = async (book: string, chapter: number, verse?: number) => {
  selectBook(book, chapter);
  resetReaderScrollPosition();
  await loadBibleContent(book, chapter);
  
  // 절 정보가 있으면 해당 절로 스크롤 및 강조
  if (verse) {
    nextTick(() => {
      bibleReaderViewRef.value?.scrollToVerse(verse);
    });
  }
};

const handleVersionSelect = (version: string) => {
  selectVersion(version);
  resetReaderScrollPosition();
  loadBibleContent(currentBook.value, currentChapter.value);
};

// 네비게이션 (composable wrapper with content loading)
const goToPrevChapter = () => {
  goToPrevChapterBase();
  resetReaderScrollPosition();
  loadBibleContent(currentBook.value, currentChapter.value);
  scrollToTop();
};

const goToNextChapter = async () => {
  // 통독 모드에서 마지막 장일 때
  if (isTongdokMode.value && isAtLastTongdokChapter.value) {
    // 이미 완료된 일정이면 기존 AlreadyComplete 모달 표시
    if (isScheduleCompleted()) {
      const savedAction = getSavedAlreadyCompleteAction();
      if (savedAction) {
        await handleAlreadyCompleteAction({ action: savedAction, remember: true });
        return;
      }
      showAlreadyCompleteModal.value = true;
      return;
    }

    // 미완료 일정이면 완료 후 다음 일정 이동 모달 표시
    const savedAction = getSavedNextScheduleAction();
    if (savedAction) {
      await handleNextScheduleAction({ action: savedAction, remember: true });
      return;
    }
    showNextScheduleModal.value = true;
    return;
  }

  goToNextChapterBase();
  resetReaderScrollPosition();
  loadBibleContent(currentBook.value, currentChapter.value);
  scrollToTop();
};

const scrollToTop = () => {
  nextTick(() => {
    bibleReaderViewRef.value?.scrollToTop();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
};

// BibleViewer 이벤트 핸들러
const handleScrollPosition = (position: number) => {
  setReaderScrollPosition(position, true);
  saveReadingPosition(currentBook.value, currentChapter.value, currentVersion.value, false, position);
};

const handleBookmarkAction = (_verses: VerseSelection) => {
  // 북마크 기능: 현재 장 단위 북마크만 지원, 절 단위는 추후 구현 예정
};

const handleHighlightAction = (verses: VerseSelection) => {
  if (!requireAuth()) return;
  openHighlightModal({ start: verses.start, end: verses.end });
};

// 하이라이트 저장
const handleHighlightSave = async (data: { color: string; memo: string }) => {
  if (!highlightSelection.value) return;

  const existingHighlight = chapterHighlights.value.find(
    h => h.start_verse === highlightSelection.value!.start &&
         h.end_verse === highlightSelection.value!.end
  );

  try {
    if (existingHighlight) {
      const result = await updateHighlight(existingHighlight.id, {
        color: data.color,
        memo: data.memo
      });
      if (result) {
        toast.success('하이라이트가 수정되었습니다');
      } else {
        toast.error('하이라이트 수정에 실패했습니다');
      }
    } else {
      const result = await createHighlight({
        book: currentBook.value,
        chapter: currentChapter.value,
        start_verse: highlightSelection.value.start,
        end_verse: highlightSelection.value.end,
        color: data.color,
        memo: data.memo
      });
      if (result) {
        toast.success('하이라이트가 추가되었습니다');
      } else {
        toast.error('하이라이트 추가에 실패했습니다');
      }
    }
  } catch (error) {
    handleApiError(error, '하이라이트 저장');
  }
};

// 하이라이트 삭제 (모달에서 호출)
const handleHighlightDelete = async (highlightId: number) => {
  try {
    const success = await deleteHighlight(highlightId);
    if (success) {
      toast.success('하이라이트가 삭제되었습니다');
    } else {
      toast.error('하이라이트 삭제에 실패했습니다');
    }
  } catch (error) {
    handleApiError(error, '하이라이트 삭제');
  }
};

// 하이라이트 직접 삭제 (액션 메뉴에서 호출 - 확인 없이 바로 삭제)
const handleHighlightDeleteDirect = async (highlightId: number) => {
  try {
    const success = await deleteHighlight(highlightId);
    if (success) {
      toast.success('하이라이트가 삭제되었습니다');
    } else {
      toast.error('하이라이트 삭제에 실패했습니다');
    }
  } catch (error) {
    handleApiError(error, '하이라이트 삭제');
  }
};

// 사용자 지정 색상 추가
const handleAddCustomColor = (color: string) => {
  addCustomColor(color);
};

const handleCopyAction = (_text: string) => {
  toast.success('복사 완료');
};

const handleShareAction = async (selection: SelectionSharePayload) => {
  const verseRange = {
    start: selection.startVerse,
    end: selection.endVerse,
  };
  const shareUrl = generateShareUrl(verseRange);
  const verseLabel = verseRange.start === verseRange.end
    ? `${verseRange.start}절`
    : `${verseRange.start}-${verseRange.end}절`;
  const title = `${currentBookName.value} ${currentChapter.value}${chapterSuffix.value} ${verseLabel}`;
  const shareData = {
    title,
    url: shareUrl
  };

  // Web Share API 지원 시 네이티브 공유
  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      // 사용자 취소 무시, 실패 시 클립보드로 폴백
      handleUserActionError(err, '공유', () => copyToClipboard(shareUrl));
    }
  } else {
    // Web Share API 미지원 시 클립보드 복사
    await copyToClipboard(shareUrl);
  }
};

// 클립보드 복사 헬퍼
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('링크가 복사되었습니다');
  } catch (error) {
    handleApiError(error, '복사');
  }
};

// 읽기모드: 읽음 표시 핸들러
const handleMarkAsRead = async () => {
  if (!requireAuth()) return;

  if (isCurrentChapterRead.value) {
    toast.info('이미 읽음으로 표시되었습니다');
    return;
  }

  try {
    await markAsRead(currentBook.value, currentChapter.value);
    toast.success(`${currentBookName.value} ${currentChapter.value}${chapterSuffix.value} 읽음 완료!`);
  } catch (error) {
    handleApiError(error, '읽음 표시');
  }
};

// 통독모드: 종료 핸들러
const handleExitTongdok = async () => {
  const confirmed = await modal.confirm({
    title: '통독모드 종료',
    description: '통독모드를 종료하시겠습니까?',
    confirmText: '종료',
    cancelText: '취소',
  });
  
  if (confirmed) {
    disableTongdokMode();
  }
};

const handleEmbeddedAudioLink = (_audioLink: string) => {
  showTongdokAudioPlayer.value = true;
};

// 통독모드: 오디오 링크 핸들러
const handleAudioLink = (audioLink: string) => {
  const videoId = audioLink.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/
  )?.[1];

  if (!videoId) {
    if (window.__nativeBridge?.isNativeApp()) {
      window.__nativeBridge.sendToNative({ type: 'navigate', url: audioLink });
    } else {
      window.open(audioLink, '_blank');
    }
    return;
  }

  const webUrl = `https://www.youtube.com/watch?v=${videoId}`;

  if (window.__nativeBridge?.isNativeApp()) {
    window.__nativeBridge.sendToNative({ type: 'navigate', url: webUrl });
  } else {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      const youtubeAppUrl = `vnd.youtube://${videoId}`;
      window.location.href = youtubeAppUrl;
      setTimeout(() => {
        window.location.href = webUrl;
      }, 1000);
    } else {
      window.open(webUrl, '_blank');
    }
  }
};

const handleTongdokAudioEnded = async () => {
  if (!isTongdokMode.value || isCompleting.value) return;
  if (!requireAuth('로그인해야 통독 기록을 저장할 수 있습니다')) return;

  const success = await completeReading();

  if (success) {
    showTongdokAudioPlayer.value = false;
    toast.success('통독 오디오를 완료했습니다!');
    router.push('/plan');
  } else {
    toast.error('완료 처리에 실패했습니다');
  }
};

// 통독모드: 버튼 클릭 핸들러
const handleTodayTongdok = async () => {
  // 선택된 플랜 ID 확인
  const planId = selectedPlanStore.effectivePlanId;
  
  // 플랜이 없으면 구독 목록을 로드하고 플랜 선택 모달 표시
  if (!planId) {
    await subscriptionStore.fetchSubscriptions();
    
    if (subscriptions.value.length === 0) {
      toast.info('구독 중인 플랜이 없습니다. 플랜 관리에서 플랜을 구독해주세요.');
      return;
    }
    
    // 구독 목록이 있으면 플랜 선택 모달 표시
    showTongdokPlanModal.value = true;
    return;
  }

  // 플랜이 있으면 성경통독표 모달 표시
  showScheduleModal.value = true;
};

// 플랜 선택 모달에서 플랜 선택 핸들러
const handleTongdokPlanSelect = (subscription: { plan_id: number; plan_name: string; is_default: boolean }) => {
  showTongdokPlanModal.value = false;
  
  // 선택한 플랜을 저장
  selectedPlanStore.setSelectedPlanId(subscription.plan_id);
  
  // 성경통독표 모달 표시
  showScheduleModal.value = true;
};

// 플랜 선택 모달에서 플랜 관리로 이동
const handleTongdokPlanManage = () => {
  showTongdokPlanModal.value = false;
  router.push('/plans');
};

// 성경통독표에서 일정 선택 핸들러
interface ScheduleSelectPayload {
  book: string;
  start_chapter: number;
  id: number;
  plan_detail?: Array<{
    book: string;
    start_chapter: number;
    end_chapter: number;
    is_complete: boolean;
  }>;
}

const handleScheduleSelect = (schedule: ScheduleSelectPayload) => {
  showScheduleModal.value = false;

  enableTongdokMode(schedule.id, selectedPlanStore.effectivePlanId ?? undefined);

  if (schedule.plan_detail) {
    setReadingDetailResponse({ data: { plan_detail: schedule.plan_detail } });
  }

  // 한국어 책 이름을 영문 코드로 변환
  const bookCode = getBookCode(schedule.book);
  if (!bookCode) {
    toast.error(`알 수 없는 성경 책: ${schedule.book}`);
    return;
  }

  handleBookSelect(bookCode, schedule.start_chapter);
};

// 북마크: 토글 핸들러
const handleBookmarkToggle = async () => {
  if (!requireAuth()) return;

  try {
    const result = await toggleChapterBookmark(
      currentBook.value,
      currentChapter.value,
      currentBookName.value
    );

    if (result.success) {
      if (result.added) {
        toast.success('북마크에 추가되었습니다');
      } else {
        toast.info('북마크가 삭제되었습니다');
      }
    }
  } catch (error) {
    handleApiError(error, '북마크 처리');
  }
};

// 노트: 클릭 핸들러
const handleNoteClick = () => {
  if (!requireAuth()) return;
  showNoteModal.value = true;
};

// 노트: 저장 핸들러
const handleNoteSave = async (content: string) => {
  try {
    const success = await saveQuickNote(
      currentBook.value,
      currentChapter.value,
      content
    );
    if (success) {
      toast.success('묵상노트가 저장되었습니다');
    }
  } catch (error) {
    handleApiError(error, '묵상노트 저장');
  }
};

// 노트: 상세 편집으로 이동
const handleNoteGoDetail = (noteId?: number, _content?: string) => {
  if (noteId) {
    router.push(`/bible/notes/${noteId}`);
  } else {
    // 새 노트 작성 후 목록으로
    router.push('/bible/notes');
  }
};

// 통독모드: 완료 처리 핸들러
const handleTongdokComplete = async (payload: { autoComplete: boolean }) => {
  if (!requireAuth('로그인해야 통독 기록을 저장할 수 있습니다')) {
    closeTongdokCompleteModal();
    return;
  }

  if (payload.autoComplete !== tongdokAutoComplete.value) {
    readingSettingsStore.updateSetting('tongdokAutoComplete', payload.autoComplete);
  }

  const success = await completeReading();

  closeTongdokCompleteModal();

  if (success) {
    toast.success('오늘 통독을 완료했습니다!');
    router.push('/plan');
  } else {
    toast.error('완료 처리에 실패했습니다');
  }
};

const handleAlreadyCompleteAction = async (payload: { action: AlreadyCompleteAction; remember: boolean }) => {
  if (payload.remember && payload.action !== 'cancel') {
    saveAlreadyCompleteAction(payload.action);
  }

  showAlreadyCompleteModal.value = false;

  switch (payload.action) {
    case 're-complete': {
      if (!requireAuth('로그인해야 통독 기록을 저장할 수 있습니다')) return;
      const success = await completeReading();
      if (success) {
        toast.success('통독을 다시 완료 처리했습니다!');
        router.push('/plan');
      } else {
        toast.error('완료 처리에 실패했습니다');
      }
      break;
    }
    case 'go-next': {
      disableTongdokMode();
      goToNextChapterBase();
      loadBibleContent(currentBook.value, currentChapter.value);
      scrollToTop();
      break;
    }
    case 'cancel':
    default:
      break;
  }
};

// 통독 완료 후 다음 일정 이동 핸들러
const handleNextScheduleAction = async (payload: { action: NextScheduleAction; remember: boolean }) => {
  if (payload.remember && payload.action !== 'cancel') {
    saveNextScheduleAction(payload.action);
  }

  switch (payload.action) {
    case 'go-next-schedule': {
      // 현재 일정 완료 처리
      if (!requireAuth('로그인해야 통독 기록을 저장할 수 있습니다')) return;
      
      const planId = tongdokPlanId.value;
      if (!planId) {
        toast.error('플랜 정보를 찾을 수 없습니다');
        showNextScheduleModal.value = false;
        return;
      }

      const success = await completeReading();
      if (!success) {
        toast.error('완료 처리에 실패했습니다');
        showNextScheduleModal.value = false;
        return;
      }

      toast.success('통독을 완료했습니다!');

      // 다음 미완료 일정 조회
      const nextPosition = await fetchNextPosition(planId);
      
      if (!nextPosition || nextPosition.status === 'all_completed') {
        toast.info('모든 일정을 완료했습니다! 🎉');
        showNextScheduleModal.value = false;
        router.push('/plan');
        return;
      }

      // 해당 월의 일정 조회해서 schedule 정보 찾기
      const monthSchedules = await fetchMonthlySchedules(planId, nextPosition.month);
      const nextSchedule = monthSchedules.find(s => s.id === nextPosition.schedule_id);
      
      if (!nextSchedule) {
        toast.error('다음 일정 정보를 찾을 수 없습니다');
        showNextScheduleModal.value = false;
        router.push('/plan');
        return;
      }

      // 다음 일정으로 통독모드 전환
      enableTongdokMode(nextPosition.schedule_id, planId);
      
      // 한국어 책 이름을 영문 코드로 변환
      const bookCode = getBookCode(nextSchedule.book);
      if (!bookCode) {
        toast.error(`알 수 없는 성경 책: ${nextSchedule.book}`);
        showNextScheduleModal.value = false;
        return;
      }

      showNextScheduleModal.value = false;
      await handleBookSelect(bookCode, nextSchedule.start_chapter);
      scrollToTop();
      break;
    }
    case 'cancel':
    default:
      showNextScheduleModal.value = false;
      break;
  }
};

// 헬퍼: 사용자 데이터 로딩 (인증된 사용자 전용)
const loadUserDataForChapter = async (book: string, chapter: number, skipReadChapters = false) => {
  if (!auth.isAuthenticated.value) return;

  const promises: Promise<void>[] = [
    fetchChapterNotes(book, chapter),
    fetchChapterHighlights(book, chapter),
    loadBookmarks(book, chapter),
  ];

  if (!skipReadChapters) {
    promises.unshift(fetchReadChapters(book));
  }

  await Promise.all(promises);
};

// 헬퍼: reader 모드 진입 (공통 로직)
// Note: 사용자 데이터 로딩은 book/chapter watch에서 자동 처리됨
const enterReaderMode = async (book: string, chapter: number) => {
  currentBook.value = book;
  currentChapter.value = chapter;
  viewMode.value = 'reader';
  await loadBibleContent(book, chapter);
};

// 진입점 모드 핸들러: 홈에서 계속 읽기
const handleContinueReading = async () => {
  const lastPos = await loadReadingPosition();
  if (lastPos) {
    currentVersion.value = lastPos.version || 'GAE';
    await enterReaderMode(lastPos.book, lastPos.chapter);
    await restoreSavedScrollPosition(lastPos.scroll_position);
  } else {
    resetReaderScrollPosition();
    await enterReaderMode(currentBook.value, currentChapter.value);
  }
};

// 진입점 모드 핸들러: 홈에서 책 선택
const handleHomeBookSelect = async (bookId: string, chapter: number = 1) => {
  resetReaderScrollPosition();
  await enterReaderMode(bookId, chapter);
};

// 진입점 모드 핸들러: 목차에서 책 선택
const handleTocBookSelect = async (bookId: string, chapter: number = 1) => {
  resetReaderScrollPosition();
  await enterReaderMode(bookId, chapter);
};

// 진입점 모드 핸들러: 목차에서 뒤로가기
const handleTocBack = () => {
  // 기본 진입점은 항상 last-position이므로 이전 페이지로 이동
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/');
  }
};

// 라이프사이클
onMounted(async () => {
  initTongdokMode();

  // URL에 book/chapter/plan/tongdok이 있으면 그것을 사용 (바로 reader로)
  const hasBibleLocationQuery = route.query.book || route.query.chapter || route.query.verse;
  const hasQueryParams = hasBibleLocationQuery || route.query.plan || route.query.tongdok;

  if (hasQueryParams) {
    viewMode.value = 'reader';
    initFromQuery();
    resetReaderScrollPosition();
    await loadBibleContent(currentBook.value, currentChapter.value);
    await focusPendingVerseRange();
    
    // 통독/플랜 상태용 쿼리는 기존처럼 정리하되, 공유 가능한 성경 위치 딥링크는 유지한다.
    if (!hasBibleLocationQuery) {
      router.replace({ path: '/bible' });
    }
  } else if (!tongdokMode.value) {
    // 쿼리 파라미터가 없고 통독모드가 아니면 마지막 위치로 이동
    viewMode.value = 'reader';
    const lastPos = await loadReadingPosition();
    if (lastPos) {
      currentBook.value = lastPos.book;
      currentChapter.value = lastPos.chapter;
      currentVersion.value = lastPos.version || 'GAE';
    }
    await loadBibleContent(currentBook.value, currentChapter.value);
    await restoreSavedScrollPosition(lastPos?.scroll_position);
  } else {
    // tongdokMode가 true이고 query params가 없는 경우 (새로고침 후)
    // 반드시 저장된 reading position에서 복원해야 함
    viewMode.value = 'reader';
    
    const lastPos = await loadReadingPosition();
    if (lastPos) {
      currentBook.value = lastPos.book;
      currentChapter.value = lastPos.chapter;
      currentVersion.value = lastPos.version || 'GAE';
    }
    
    await loadBibleContent(currentBook.value, currentChapter.value);
    await restoreSavedScrollPosition(lastPos?.scroll_position);
    
    // 통독모드 진입 시에도 URL 정리 (상태는 localStorage에서 관리)
    if (Object.keys(route.query).length > 0) {
      router.replace({ path: '/bible' });
    }
  }

  // 읽기 기록, 노트, 북마크 조회 (로그인 시, reader 모드일 때만)
  if (viewMode.value === 'reader') {
    await loadUserDataForChapter(
      currentBook.value,
      currentChapter.value,
      isTongdokMode.value // 통독모드일 때 readChapters 스킵
    );
  }

  // 통독모드일 때 읽기 상세 정보 로드
  if (isTongdokMode.value && tongdokPlanId.value) {
    await loadReadingDetail(tongdokPlanId.value, currentBook.value, currentChapter.value);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload);
  }

  enablePositionSaving();
});

onBeforeUnmount(() => {
  cleanupReadingPosition();
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }
  saveReadingPosition(
    currentBook.value,
    currentChapter.value,
    currentVersion.value,
    true,
    getExplicitReaderScrollPosition()
  );
});

const handleBeforeUnload = () => {
  saveReadingPosition(
    currentBook.value,
    currentChapter.value,
    currentVersion.value,
    true,
    getExplicitReaderScrollPosition()
  );
};

// route.query 변경 감지 (딥링크 처리)
watch(
  () => route.query,
  async (newQuery) => {
    // 쿼리 파라미터가 있으면 처리 (딥링크로 접근한 경우)
    const hasBibleLocationQuery = newQuery.book || newQuery.chapter || newQuery.verse;
    if (hasBibleLocationQuery || newQuery.tongdok) {
      initFromQuery();
      resetReaderScrollPosition();
      await loadBibleContent(currentBook.value, currentChapter.value);
      await focusPendingVerseRange();
      
      // 통독 상태용 쿼리는 기존처럼 정리하되, 공유 가능한 성경 위치 딥링크는 유지한다.
      if (!hasBibleLocationQuery) {
        router.replace({ path: '/bible' });
      }
    }
  }
);

// 책 변경 시 읽기 기록 조회
watch(
  () => currentBook.value,
  async (newBook) => {
    if (auth.isAuthenticated.value && !isTongdokMode.value) {
      await fetchReadChapters(newBook);
    }
  }
);

// 책/장 변경 시 노트, 하이라이트, 북마크 조회
watch(
  [() => currentBook.value, () => currentChapter.value],
  async ([newBook, newChapter]) => {
    if (auth.isAuthenticated.value) {
      await fetchChapterNotes(newBook, newChapter);
      await fetchChapterHighlights(newBook, newChapter);
      await loadBookmarks(newBook, newChapter);
    }
  }
);

watch(
  [() => currentBook.value, () => currentChapter.value, () => currentVersion.value],
  () => {
    saveReadingPosition(
      currentBook.value,
      currentChapter.value,
      currentVersion.value,
      false,
      getExplicitReaderScrollPosition()
    );
  },
  { flush: 'post' }
);

// 통독모드에서 책/장 변경 시 읽기 상세 정보 로드
watch(
  [() => currentBook.value, () => currentChapter.value, () => tongdokMode.value],
  async ([newBook, newChapter, isTongdok]) => {
    if (isTongdok && tongdokPlanId.value) {
      await loadReadingDetail(tongdokPlanId.value, newBook, newChapter);
    }
  }
);
</script>

<style scoped>
.bible-page {
  max-width: 768px;
  margin: 0 auto;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card, #ffffff);
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.06);
}

@media (max-width: 768px) {
  .bible-page {
    box-shadow: none;
  }
}

/* 다크모드 */
:root.dark .bible-page {
  background: var(--color-bg-primary);
}
</style>
