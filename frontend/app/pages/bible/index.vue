<template>
  <div class="bible-page" :class="{ 'is-reader': viewMode === 'reader' }">
    <!-- 홈/대시보드 뷰 -->
    <BibleHome
      v-if="viewMode === 'home'"
      @continue-reading="handleContinueReading"
      @select-book="handleHomeBookSelect"
      @show-toc="showBookSelector = true"
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
        :compare-enabled="compareEnabled"
        :secondary-content="secondaryContent"
        :secondary-version-name="versionNames[secondaryVersion] || secondaryVersion"
        :primary-meta="versionMeta[currentVersion]"
        :secondary-meta="versionMeta[secondaryVersion]"
        :is-secondary-loading="isSecondaryLoading"
        @toggle-compare="toggleCompare"
        @compare-select="openCompareSelector"
        @compare-swap="swapCompareVersions"
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
        :highlights="visibleChapterHighlights"
        :overlay-open="overlayOpen"
        :audio-context-key="audioContextKey"
        @back="goBack"
        @prev-chapter="goToPrevChapter"
        @next-chapter="goToNextChapter"
        @open-book-selector="showBookSelector = true"
        @open-version-selector="openCompareSelector('primary')"
        @open-settings="showSettingsModal = true"
        @bookmark-toggle="handleBookmarkToggle"
        @note-click="handleNoteClick"
        @mark-as-read="handleMarkAsRead"
        @scroll="handleScrollPosition"
        @bookmark="handleBookmarkAction"
        @highlight="handleHighlightAction"
        @highlight-delete="handleHighlightDeleteDirect"
        @highlight-save="handleDirectHighlightSave"
        @copy-error="handleCopyError"
        @copy="handleCopyAction"
        @share="handleShareAction"
        @exit-tongdok="handleExitTongdok"
        @tongdok-complete-click="handleTongdokComplete"
        @today-tongdok="handleTodayTongdok"
        @audio-link-click="handleEmbeddedAudioLink"
        @audio-external-click="handleAudioLink"
        @audio-player-open-change="showTongdokAudioPlayer = $event"
        @audio-ended="handleTongdokAudioEnded"
        @reading-plan-click="openPlanSheet"
        @share-click="handleChapterShare"
        @guide-click="showGuideSheet = true"
      />

      <!-- 모달 -->
      <VersionSelector
        v-model="showVersionSelector"
        :current-version="versionColumn === 'secondary' ? secondaryVersion : currentVersion"
        @select="handleColumnVersionSelect"
      />

      <ShareSheet
        v-model="showShareSheet"
        :mode="shareMode"
        :metadata="shareMetadata"
        :verses="shareVerses"
        :share-url="shareUrl"
        :plan-id="shareContext.planId"
        :schedule-id="shareContext.scheduleId"
        @error="handleShareError"
        @result="handleShareResult"
      />

      <ReaderGuideSheet
        v-model="showGuideSheet"
        :schedule-title="fullTongdokRange"
        :guide-link="tongdokGuideLink"
        @open-guide="handleAudioLink"
      />
      <ReaderPlanSheet
        v-model="showScheduleModal"
        :plan-name="readerPlanName"
        :date-label="isTongdokMode ? tongdokScheduleDate || '' : nextSchedule?.date || ''"
        :range-label="compactPlanRange"
        :rows="planRows"
        :next-schedule-label="nextScheduleLabel"
        :is-tongdok-mode="isTongdokMode"
        :is-loading="isPlanLoading"
        @select-chapter="handlePlanChapterSelect"
        @next-position="handlePlanNext"
        @start-tongdok="handlePlanStart"
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
      <ReadingSettingsSheet
        v-model="showSettingsModal"
        :current-version="currentVersion"
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
        v-model="showFullScheduleModal"
        title="성경통독표"
        size="lg"
        :no-padding="true"
      >
        <BibleScheduleContent
          v-if="showFullScheduleModal"
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
    <BookSelector
      v-model="showBookSelector"
      :current-book="currentBook"
      :current-chapter="currentChapter"
      :current-version="currentVersion"
      :read-chapters="selectorReadChapters"
      @select="handleBookSelect"
      @version-select="handleVersionSelect"
    />
    <SidebarNav v-if="viewMode !== 'reader'" />
    <BottomNavigation v-if="viewMode !== 'reader'" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SidebarNav from '~/components/common/SidebarNav.vue';
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
import { VERSION_NAMES, VERSION_META, VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';
import {
  parseVerseRangeParam,
  useBiblePageState,
  type BibleVerseRange,
} from '~/composables/bible/useBiblePageState';
import {
  buildReadingPositionSaveCommand,
  getBibleRouteQueryPolicy,
  getExplicitReaderScrollPosition as selectExplicitReaderScrollPosition,
  resetReaderScrollState,
  setReaderScrollState,
  type ReaderScrollState,
} from '~/composables/bible/readerScrollState';
import { useAuthGuard } from '~/composables/useAuthGuard';
import { useAuthService } from '~/composables/useAuthService';
import { useReadingSettingsStore } from '~/stores/readingSettings';
import { useSelectedPlanStore } from '~/stores/selectedPlan';
import { useSubscriptionStore } from '~/stores/subscription';
import { useToast } from '~/composables/useToast';
import { useModal } from '~/composables/useModal';
import { useApi } from '~/composables/useApi';
// 뷰 컴포넌트
import BottomNavigation from '~/components/BottomNavigation.vue';
import BibleHome from '~/components/bible/BibleHome.vue';
import BibleTOC from '~/components/bible/BibleTOC.vue';
import BibleReaderView from '~/components/bible/BibleReaderView.vue';
import type { SelectionSharePayload, SelectionHighlightPayload } from '~/components/bible/BibleViewer.vue';

// 모달 컴포넌트
import BookSelector from '~/components/bible/BookSelector.vue';
import VersionSelector from '~/components/bible/VersionSelector.vue';
import ReaderCompletionContent, { type ReaderCompletionHighlight } from '~/components/bible/ReaderCompletionContent.vue';
import ReaderGuideSheet from '~/components/bible/ReaderGuideSheet.vue';
import ReaderPlanSheet, { type ReaderPlanChapterRow } from '~/components/bible/ReaderPlanSheet.vue';
import ShareSheet from '~/components/bible/share/ShareSheet.vue';
import type { AudioEndedSource } from '~/components/bible/TongdokAudioPlayer.vue';
import type { BibleShareMetadata, BibleShareVerse } from '~/composables/bible/bibleShare';
import type { Schedule } from '~/types/plan';
import NoteQuickModal from '~/components/bible/NoteQuickModal.vue';
import HighlightModal from '~/components/bible/HighlightModal.vue';
import ReadingSettingsSheet from '~/components/ReadingSettingsSheet.vue';
import BibleScheduleContent from '~/components/BibleScheduleContent.vue';
import PlanSelectorModal from '~/components/schedule/PlanSelectorModal.vue';
import BaseModal from '~/components/ui/modal/BaseModal.vue';

// 기타
import Toast from '~/components/Toast.vue';

// 유틸리티
import { getBookCode } from '~/constants/bible';
import { parseSearchFocusParam } from '~/utils/bibleSearchRoute';

// 타입
import type { VerseSelection } from '~/types/bible';

definePageMeta({
  layout: 'default'
});

const nuxtApp = useNuxtApp();
const route = useRoute();
const router = useRouter();
const auth = useAuthService();
const { requireAuth, requireAuthWithPrompt } = useAuthGuard();
const readingSettingsStore = useReadingSettingsStore();
const selectedPlanStore = useSelectedPlanStore();
const subscriptionStore = useSubscriptionStore();
const toast = useToast();
const modal = useModal();
const api = useApi();
const { fetchNextPosition, fetchMonthlySchedules } = useScheduleApi();
const { handleApiError } = useErrorHandler();

// Composables
const {
  readChapters,
  clearCache: clearReadChapters,
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
  disableTongdokMode,
  enableTongdokMode,
  completeCurrentChapter,
  markAllScheduleChapters,
  isChapterCompleted,
  getCurrentSectionChapters,
  readingDetailResponse,
  loadReadingDetail,
  getAudioLink,
  getGuideLink,
  getScheduleDate,
  getTongdokProgress,
} = useTongdokMode();
const {
  loadReadingPosition,
  saveReadingPosition,
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

// Each load owns its content ref so a superseded request cannot paint another chapter.
const bibleContent = ref('');
const isLoading = ref(true);
let contentGeneration = 0;

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
  initFromQuery: initFromQueryBase,
  generateShareUrl,
} = useBiblePageState();
viewMode.value = getBibleRouteQueryPolicy(route.query).shouldInitializeOnEntry ? 'reader' : 'home';
if (viewMode.value === 'reader') initFromQueryBase(route.query);

// 모달 상태 (useBibleModals composable로 통합 관리)
const {
  showBookSelector,
  showVersionSelector,
  showHighlightModal,
  showSettingsModal,
  highlightSelection,
  openHighlightModal,
} = useBibleModals();

const versionNames: Record<string, string> = VERSION_NAMES;
const versionMeta: Record<string, { direction: string; language: string; testament: string }> = VERSION_META;
const compareEnabled = ref(false);
const secondaryVersion = ref('KNT');
const secondaryContent = ref('');
const isSecondaryLoading = ref(false);
const versionColumn = ref<'primary' | 'secondary'>('primary');
let secondaryGeneration = 0;
// Reuse already parsed chapters when exchanging columns; primary remains route-owned.
const compareChapters = new Map<string, string>();
const chapterKey = (book: string, chapter: number, version: string) => `${book}:${chapter}:${version}`;
const persistCompare = () => {
  try { localStorage.setItem('bibleCompare', JSON.stringify({ enabled: compareEnabled.value, secondaryVersion: secondaryVersion.value })); }
  catch (error) { console.warn('Failed to save compare preferences:', error); }
};
const toggleCompare = () => {
  compareEnabled.value = !compareEnabled.value;
  if (compareEnabled.value && secondaryVersion.value === currentVersion.value) secondaryVersion.value = currentVersion.value === 'GAE' ? 'KNT' : 'GAE';
  persistCompare();
};
const openCompareSelector = (column: 'primary' | 'secondary') => {
  versionColumn.value = column;
  showVersionSelector.value = true;
};
const handleColumnVersionSelect = async (version: string) => {
  if (versionColumn.value === 'primary') await handleVersionSelect(version);
  else { secondaryVersion.value = version; persistCompare(); }
};
const swapCompareVersions = async () => {
  const primary = currentVersion.value;
  const secondary = secondaryVersion.value;
  secondaryVersion.value = primary;
  persistCompare();
  await handleVersionSelect(secondary);
};
const loadSecondaryContent = async () => {
  const generation = ++secondaryGeneration;
  if (!compareEnabled.value || viewMode.value !== 'reader') { isSecondaryLoading.value = false; return; }
  const book = currentBook.value;
  const chapter = currentChapter.value;
  const version = secondaryVersion.value;
  const key = chapterKey(book, chapter, version);
  isSecondaryLoading.value = true;
  secondaryContent.value = '';
  const cached = compareChapters.get(key);
  if (cached !== undefined) { secondaryContent.value = cached; isSecondaryLoading.value = false; return; }
  const loader = await nuxtApp.runWithContext(() => useBibleContent());
  await loader.loadContent(book, chapter, version);
  if (!pageActive || generation !== secondaryGeneration) return;
  secondaryContent.value = loader.content.value;
  if (!loader.error?.value) compareChapters.set(key, loader.content.value);
  isSecondaryLoading.value = false;
};
watch([compareEnabled, secondaryVersion, currentBook, currentChapter, viewMode], loadSecondaryContent);

const showShareSheet = ref(false);
const showGuideSheet = ref(false);
const showFullScheduleModal = ref(false);
const shareMode = ref<'verse' | 'complete'>('verse');
const shareMetadata = ref<BibleShareMetadata>({});
const shareVerses = ref<BibleShareVerse[]>([]);
const shareUrl = ref('');
const shareContext = ref<{ planId: number | null; scheduleId: number | null }>({ planId: null, scheduleId: null });
const completionPreparing = ref(false);
const completionModalId = 'bible-reader-completion';
const nextSchedule = ref<Schedule | null>(null);
const isPlanLoading = ref(false);
const progressRevision = ref(0);
const readerReady = ref(false);
let pageActive = true;
let routeGeneration = 0;
let routeLoad: Promise<void> = Promise.resolve();

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
const tongdokAudioLink = computed(() =>
  getAudioLink(currentBook.value, currentChapter.value)
);
const tongdokGuideLink = computed(() => getGuideLink());
const tongdokScheduleDate = computed(() => getScheduleDate());
const readerContextKey = computed(() => JSON.stringify([
  viewMode.value, auth.user.value?.id, isTongdokMode.value, tongdokPlanId.value,
  tongdokScheduleId.value, tongdokScheduleDate.value, currentBook.value,
  currentChapter.value, currentVersion.value,
]));
const audioContextKey = computed(() => `${readerContextKey.value}|${tongdokAudioLink.value ?? ''}`);
const tongdokProgress = computed(() => {
  // Chapter marks are owned by the mode service's active-session Set.
  progressRevision.value;
  const progress = getTongdokProgress(currentBook.value, currentChapter.value);
  return progress ? { ...progress, completed: getCurrentSectionChapters(currentBook.value)
    .flatMap(section => section.chapters.map(chapter => isChapterCompleted(section.book, chapter))) } : null;
});
const visibleChapterHighlights = computed(() => auth.isAuthenticated.value
  ? chapterHighlights.value.filter(h => h.book === currentBook.value && h.chapter === currentChapter.value)
  : []);
const selectorReadChapters = computed(() => {
  progressRevision.value;
  if (!auth.isAuthenticated.value) return {};
  if (!isTongdokMode.value) return Object.fromEntries([...readChapters.value].map(([book, chapters]) => [book, [...chapters]]));
  const result: Record<string, number[]> = {};
  for (const section of getCurrentSectionChapters(currentBook.value)) {
    result[section.book] = [...(result[section.book] || []), ...section.chapters.filter(chapter => isChapterCompleted(section.book, chapter))];
  }
  return result;
});
const overlayOpen = computed(() => showBookSelector.value || showVersionSelector.value ||
  showSettingsModal.value || showNoteModal.value || showHighlightModal.value ||
  showScheduleModal.value || showFullScheduleModal.value || showTongdokPlanModal.value ||
  showGuideSheet.value || showShareSheet.value || completionPreparing.value || modal.isOpen.value);
watch(overlayOpen, open => {
  if (open) bibleReaderViewRef.value?.bibleViewerRef?.clearSelection();
}, { flush: 'sync' });
const readerPlanName = computed(() => readingDetailResponse.value?.data?.plan_name ||
  subscriptions.value.find(sub => sub.plan_id === selectedPlanStore.effectivePlanId)?.plan_name || '');
const planRows = computed<ReaderPlanChapterRow[]>(() => {
  progressRevision.value;
  if (!isTongdokMode.value) {
    const schedule = nextSchedule.value;
    const book = schedule ? getBookCode(schedule.book) : null;
    if (!schedule || !book) return [];
    return Array.from({ length: schedule.end_chapter - schedule.start_chapter + 1 }, (_, index) => ({
      scheduleId: schedule.id, book, chapter: schedule.start_chapter + index,
      label: `${schedule.book} ${schedule.start_chapter + index}${book === 'psa' ? '편' : '장'}`,
      status: schedule.is_completed ? 'completed' : 'upcoming',
    } satisfies ReaderPlanChapterRow));
  }
  return (readingDetailResponse.value?.data?.plan_detail || []).flatMap(row => {
    if (!row.schedule_id) return [];
    return Array.from({ length: row.end_chapter - row.start_chapter + 1 }, (_, index) => {
      const chapter = row.start_chapter + index;
      return { scheduleId: row.schedule_id!, book: row.book, chapter,
        label: `${row.book_kor || getCurrentSectionChapters(row.book).find(section => section.book === row.book)?.book_kor || row.book} ${chapter}${row.book === 'psa' ? '편' : '장'}`,
        status: isChapterCompleted(row.book, chapter) ? 'completed' :
          row.book === currentBook.value && chapter === currentChapter.value ? 'current' : 'not_completed' } satisfies ReaderPlanChapterRow;
    });
  });
});
const nextScheduleLabel = computed(() => nextSchedule.value
  ? `${nextSchedule.value.date} · ${nextSchedule.value.book} ${nextSchedule.value.start_chapter}-${nextSchedule.value.end_chapter}장`
  : null);
const compactPlanRange = computed(() => isTongdokMode.value ? fullTongdokRange.value : nextSchedule.value
  ? `${nextSchedule.value.book} ${nextSchedule.value.start_chapter}-${nextSchedule.value.end_chapter}장` : '');

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
  const generation = ++contentGeneration;
  const version = currentVersion.value;
  const key = chapterKey(book, chapter, version);
  const cached = compareChapters.get(key);
  if (compareEnabled.value && cached !== undefined) { bibleContent.value = cached; isLoading.value = false; return; }
  const loader = await nuxtApp.runWithContext(() => useBibleContent());
  isLoading.value = true;
  await loader.loadContent(book, chapter, version);
  if (!pageActive || generation !== contentGeneration) return;
  bibleContent.value = loader.content.value;
  if (!loader.error?.value) compareChapters.set(key, loader.content.value);
  isLoading.value = false;
};

const focusPendingVerseRange = async () => {
  const verseRange = pendingVerseFocus.value;
  if (!verseRange) return;

  await nextTick();
  bibleReaderViewRef.value?.focusVerseRange(verseRange.start, verseRange.end, pendingSearchFocus.value);
};

const applyReaderScrollState = (state: ReaderScrollState): void => {
  scrollPosition.value = state.scrollPosition;
  hasReaderScrollPosition.value = state.hasReaderScrollPosition;
};

const setReaderScrollPosition = (position: number, fromReaderScroll = false) => {
  applyReaderScrollState(setReaderScrollState(position, fromReaderScroll));
};

const resetReaderScrollPosition = () => {
  applyReaderScrollState(resetReaderScrollState());
};

const restoreSavedScrollPosition = async (position: number | undefined) => {
  if (typeof position !== 'number') return;
  setReaderScrollPosition(position, true);
  await nextTick();
  bibleReaderViewRef.value?.restoreScrollPosition();
  // BibleViewer owns the reading scroller; never scroll the hub/document here.
};

const getExplicitReaderScrollPosition = () => selectExplicitReaderScrollPosition({
  scrollPosition: scrollPosition.value,
  hasReaderScrollPosition: hasReaderScrollPosition.value,
});

const saveCurrentReadingPosition = (
  immediate: boolean,
  explicitScrollPosition = getExplicitReaderScrollPosition(),
): Promise<void> => {
  if (viewMode.value !== 'reader' || !readerReady.value) return Promise.resolve();
  const command = buildReadingPositionSaveCommand({
    book: currentBook.value,
    chapter: currentChapter.value,
    version: currentVersion.value,
  }, immediate, explicitScrollPosition);

  return saveReadingPosition(
    command.book,
    command.chapter,
    command.version,
    command.immediate,
    command.explicitScrollPosition,
  );
};

const navigateReader = async (book: string, chapter: number, verse?: number, version = currentVersion.value) => {
  await saveCurrentReadingPosition(true);
  const query = {
    book, chapter: String(chapter), version,
    ...(verse ? { verse: String(verse) } : {}),
    ...(isTongdokMode.value ? { tongdok: 'true',
      ...(tongdokPlanId.value ? { plan: String(tongdokPlanId.value) } : {}),
      ...(tongdokScheduleId.value ? { schedule: String(tongdokScheduleId.value) } : {}),
      ...(tongdokScheduleDate.value ? { date: tongdokScheduleDate.value } : {}),
    } : {}),
  };
  await router.push({ path: '/bible', query });
  await nextTick();
  await routeLoad;
};

const handleBookSelect = (book: string, chapter: number, verse?: number) => navigateReader(book, chapter, verse);
const handleVersionSelect = async (version: string) => {
  if (viewMode.value !== 'reader') {
    currentVersion.value = version;
    return;
  }
  await navigateReader(currentBook.value, currentChapter.value, undefined, version);
  toast.success(`${currentVersionName.value}으로 전환`);
};
const goToPrevChapter = async () => {
  await saveCurrentReadingPosition(true);
  readerReady.value = false;
  const position = goToPrevChapterBase();
  if (position) await navigateReader(position.book, position.chapter);
  else readerReady.value = true;
};
const goToNextChapter = async () => {
  // 통독 모드에서 마지막 장이면 완료 여부를 먼저 묻는다.
  if (isTongdokMode.value && isAtLastTongdokChapter.value) {
    const confirmed = await modal.confirm({
      title: '오늘 통독을 완료할까요?',
      description: `${fullTongdokRange.value || '오늘 일정'}을 다 읽으셨다면 완료로 기록해요.`,
      confirmText: '통독 완료',
      cancelText: '계속 읽기',
    });
    if (confirmed) {
      await handleTongdokComplete();
      return;
    }
  }
  await saveCurrentReadingPosition(true);
  readerReady.value = false;
  const position = goToNextChapterBase();
  if (position) await navigateReader(position.book, position.chapter);
  else readerReady.value = true;
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
  saveCurrentReadingPosition(false, position);
};

const handleBookmarkAction = (_verses: VerseSelection) => {
  // 북마크 기능: 현재 장 단위 북마크만 지원, 절 단위는 추후 구현 예정
};

const handleHighlightAction = async (verses: VerseSelection) => {
  if (!(await requireAuthWithPrompt())) return;
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

const handleCopyError = (error: unknown) => handleApiError(error, '복사');
const handleShareError = (error: Error) => handleApiError(error, '공유');
const handleShareResult = (payload: { action: string; result: string }) => {
  if (payload.result === 'copied') toast.success('링크가 복사되었습니다');
  else if (payload.result === 'downloaded') toast.success('이미지를 저장했어요');
  else toast.success('공유 시트를 열었어요');
};
const handleDirectHighlightSave = async (selection: SelectionHighlightPayload) => {
  if (!(await requireAuthWithPrompt())) return;
  if (selection.book !== currentBookName.value || selection.chapter !== currentChapter.value ||
      selection.version !== currentVersionName.value) return;
  const existing = selection.highlightId === undefined ? null : visibleChapterHighlights.value.find(h =>
    h.id === selection.highlightId && h.start_verse === selection.start && h.end_verse === selection.end);
  if (selection.highlightId !== undefined && !existing) return;
  const result = existing ? await updateHighlight(existing.id, { color: selection.color }) : await createHighlight({
    book: currentBook.value, chapter: selection.chapter, start_verse: selection.start,
    end_verse: selection.end, color: selection.color,
  });
  if (result) toast.success('하이라이트 저장');
  else toast.error('하이라이트 저장에 실패했습니다');
};
// [매일일독] <참조>\n<풀 링크> 형식으로 공유. Web Share → 클립보드 폴백.
const shareBibleLink = async (reference: string, url: string) => {
  const text = `[매일일독] ${reference}\n${url}`;
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success('링크를 복사했습니다');
  } catch (error) {
    handleApiError(error, '공유');
  }
};

const handleShareAction = (selection: SelectionSharePayload) => {
  if ((selection.book && selection.book !== currentBookName.value) ||
      (selection.chapter && selection.chapter !== currentChapter.value) ||
      (selection.version && selection.version !== currentVersionName.value)) return;
  const range = { start: selection.startVerse, end: selection.endVerse };
  const reference = `${selection.book || currentBookName.value} ${selection.chapter || currentChapter.value}:${range.start}${range.end === range.start ? '' : `-${range.end}`}`;
  void shareBibleLink(reference, generateShareUrl(range));
};

const handleChapterShare = () => {
  void shareBibleLink(`${currentBookName.value} ${currentChapter.value}${chapterSuffix.value}`, generateShareUrl());
};

// 읽기모드: 읽음 표시 핸들러
const handleMarkAsRead = async () => {
  if (!(await requireAuthWithPrompt())) return;

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

const handleTongdokAudioEnded = async (source: AudioEndedSource) => {
  if (viewMode.value !== 'reader' || source.audioLink !== tongdokAudioLink.value ||
      source.audioContextKey !== audioContextKey.value) return;
  if (!isTongdokMode.value) {
    toast.info('오디오 재생이 끝났어요');
    return;
  }
  await handleTongdokComplete(undefined, source);
};

// 통독모드: 버튼 클릭 핸들러
const handleTodayTongdok = async () => {
  if (!requireAuth()) return;
  showScheduleModal.value = false;
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
  showFullScheduleModal.value = true;
};

// 플랜 선택 모달에서 플랜 선택 핸들러
const handleTongdokPlanSelect = (subscription: { plan_id: number; plan_name: string; is_default: boolean }) => {
  showTongdokPlanModal.value = false;
  
  // 선택한 플랜을 저장
  selectedPlanStore.setSelectedPlanId(subscription.plan_id);
  
  // 성경통독표 모달 표시
  showFullScheduleModal.value = true;
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
  date?: string;
  plan_detail?: Array<{
    book: string;
    start_chapter: number;
    end_chapter: number;
    is_complete: boolean;
  }>;
}

const handleScheduleSelect = (schedule: ScheduleSelectPayload) => {
  showFullScheduleModal.value = false;

  enableTongdokMode(schedule.id, selectedPlanStore.effectivePlanId ?? undefined, schedule.date ?? null);

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

// The next-position endpoint, not chronological arithmetic, owns continuation.
const fetchNextSchedule = async (planId: number): Promise<Schedule | null> => {
  const position = await fetchNextPosition(planId);
  if (!position || !position.schedule_id || !position.month || position.month < 1 || position.month > 12 ||
      ['all_completed', 'no_schedule', 'error'].includes(position.status)) return null;
  const schedules = await fetchMonthlySchedules(planId, position.month);
  return schedules.find(schedule => schedule.id === position.schedule_id) || null;
};
const continueToNextUnreadSchedule = async (planId: number): Promise<void> => {
  const context = readerContextKey.value;
  const schedule = await fetchNextSchedule(planId);
  if (!pageActive || readerContextKey.value !== context) return;
  if (!schedule) {
    toast.info('다음 일정 정보를 찾을 수 없습니다');
    return;
  }
  const book = getBookCode(schedule.book);
  if (!book) { toast.error(`알 수 없는 성경 책: ${schedule.book}`); return; }
  showScheduleModal.value = false;
  showShareSheet.value = false;
  await modal.close(completionModalId);
  enableTongdokMode(schedule.id, planId, schedule.date);
  await handleBookSelect(book, schedule.start_chapter);
  toast.success(`통독 · ${schedule.book} ${schedule.start_chapter}-${schedule.end_chapter}장`);
};
const handlePlanNext = async () => {
  const planId = tongdokPlanId.value ?? selectedPlanStore.effectivePlanId;
  if (planId) await continueToNextUnreadSchedule(planId);
};
const handlePlanStart = async () => {
  const first = planRows.value[0];
  if (first) await handlePlanChapterSelect(first);
  else await handleTodayTongdok();
};
const openPlanSheet = async () => {
  showScheduleModal.value = true;
  nextSchedule.value = null;
  const planId = tongdokPlanId.value ?? selectedPlanStore.effectivePlanId;
  if (!planId) return;
  const context = readerContextKey.value;
  isPlanLoading.value = true;
  const schedule = await fetchNextSchedule(planId);
  if (context === readerContextKey.value) nextSchedule.value = schedule;
  isPlanLoading.value = false;
};
const handlePlanChapterSelect = async (row: { scheduleId: number; book: string; chapter: number }) => {
  if (!planRows.value.some(item => item.scheduleId === row.scheduleId && item.book === row.book && item.chapter === row.chapter)) return;
  showScheduleModal.value = false;
  if (!isTongdokMode.value) {
    const planId = selectedPlanStore.effectivePlanId;
    if (!planId || !nextSchedule.value || !requireAuth()) return;
    enableTongdokMode(row.scheduleId, planId, nextSchedule.value.date);
  }
  // An active date group is one session; another row must not erase its chapter marks.
  await handleBookSelect(row.book, row.chapter);
};

const openCompletion = async (context: string, planId: number, scheduleId: number) => {
  const range = fullTongdokRange.value;
  const rows = (readingDetailResponse.value?.data?.plan_detail || []).map(row => ({ ...row }));
  const chapters = new Map<string, { book: string; chapter: number }>();
  for (const row of rows) {
    for (let chapter = row.start_chapter; chapter <= row.end_chapter; chapter++) {
      chapters.set(`${row.book}:${chapter}`, { book: row.book, chapter });
    }
  }
  const version = currentVersion.value;
  const metadata: BibleShareMetadata = { readingRange: range, ...(auth.user.value?.nickname ? { nickname: auth.user.value.nickname } : {}),
    ...(readerPlanName.value ? { planName: readerPlanName.value } : {}), ...(tongdokScheduleDate.value ? { dateLabel: tongdokScheduleDate.value } : {}) };
  completionPreparing.value = true;
  try {
    const [certification, highlightResponse, following] = await Promise.allSettled([
      api.GET('/api/v1/todos/certification/progress/', { params: { plan_id: planId, schedule_id: scheduleId } }),
      Promise.all(Array.from(chapters.values(), params =>
        api.GET('/api/v1/todos/bible/highlights/by-chapter/', { params }),
      )).then(responses => responses.flatMap(response => response.data.highlights)),
      fetchNextSchedule(planId),
    ]);
    if (!pageActive || context !== readerContextKey.value) return;
    const data = certification.status === 'fulfilled' ? certification.value.data : null;
    const validCertification = data?.success && data.plan.id === planId;
    if (!validCertification) handleApiError(certification.status === 'rejected' ? certification.reason : new Error('요청한 플랜의 인증 정보가 아닙니다.'), '인증 정보 조회');
    const actualMetadata: BibleShareMetadata = validCertification && data ? { ...metadata, nickname: data.user.nickname, planName: data.plan.name,
      ...(Number.isInteger(data.progress.currentStreak) ? { streak: data.progress.currentStreak } : {}),
      ...(data.progress.totalSchedules > 0 ? { progress: { completed: data.progress.completedSchedules,
        total: data.progress.totalSchedules, percent: data.progress.completionRate } } : {}),
    } : metadata;
    if (highlightResponse.status === 'rejected') handleApiError(highlightResponse.reason, '하이라이트 조회');
    if (following.status === 'rejected') handleApiError(following.reason, '다음 일정 조회');
    const highlights = (highlightResponse.status === 'fulfilled' ? highlightResponse.value : [])
      .filter(h => rows.some(row => row.book === h.book && h.chapter >= row.start_chapter && h.chapter <= row.end_chapter));
    const chapterContent = new Map<string, Promise<string>>();
    const completionHighlights: ReaderCompletionHighlight[] = await Promise.all(highlights.map(async highlight => {
      const key = `${highlight.book}:${highlight.chapter}`;
      if (!chapterContent.has(key)) {
        chapterContent.set(key, (async () => {
          const loader = await nuxtApp.runWithContext(() => useBibleContent());
          await loader.loadContent(highlight.book, highlight.chapter, version);
          return loader.content.value;
        })());
      }
      const html = await chapterContent.get(key)!;
      const document = new DOMParser().parseFromString(html, 'text/html');
      const text = Array.from(document.querySelectorAll('.verse')).filter(verse => {
        const number = Number(verse.querySelector('.verse-number')?.textContent);
        return number >= highlight.start_verse && number <= highlight.end_verse;
      }).flatMap(verse => Array.from(verse.querySelectorAll('.verse-text')).map(line => line.textContent?.trim() || '')).join(' ');
      const bookName = highlight.book_name || getCurrentSectionChapters(highlight.book).find(section => section.book === highlight.book)?.book_kor || highlight.book;
      return { id: highlight.id, text, color: highlight.color,
        reference: `${bookName} ${highlight.chapter}:${highlight.start_verse}${highlight.end_verse === highlight.start_verse ? '' : `-${highlight.end_verse}`}` };
    }));
    if (!pageActive || context !== readerContextKey.value) return;
    nextSchedule.value = following.status === 'fulfilled' ? following.value : null;
    const verses = completionHighlights.filter(highlight => highlight.text).map(highlight => ({ id: String(highlight.id), text: highlight.text, reference: highlight.reference }));
    const openShare = async (highlightId?: number | string) => {
      if (context !== readerContextKey.value) return;
      shareMode.value = highlightId === undefined ? 'complete' : 'verse';
      shareMetadata.value = actualMetadata;
      shareContext.value = { planId, scheduleId };
      shareVerses.value = highlightId === undefined ? verses : verses.filter(verse => verse.id === String(highlightId));
      const params = new URLSearchParams({ certification: 'tongdok', plan_id: String(planId), schedule_id: String(scheduleId) });
      shareUrl.value = `${window.location.origin}/bible/history?${params}`;
      await modal.close(completionModalId);
      showShareSheet.value = true;
    };
    void modal.open(ReaderCompletionContent, { id: completionModalId, size: 'sm', showCloseButton: false,
      props: { scheduleRange: range, streak: actualMetadata.streak, highlights: completionHighlights.filter(h => h.text), nextScheduleLabel: nextScheduleLabel.value,
        onShare: () => openShare(), onShareHighlight: openShare,
        onNext: () => continueToNextUnreadSchedule(planId), onClose: () => modal.close(completionModalId),
      },
    }).catch(error => { if (error instanceof Error) handleApiError(error, '통독 완료'); });
  } catch (error) {
    if (context === readerContextKey.value) handleApiError(error, '통독 완료 정보 조회');
  } finally {
    completionPreparing.value = false;
  }
};
const handleTongdokComplete = async (_payload?: unknown, audioSource?: AudioEndedSource) => {
  if (!isTongdokMode.value || isCompleting.value || completionPreparing.value) return;
  if (!(await requireAuthWithPrompt('로그인해야 통독 기록을 저장할 수 있습니다'))) return;
  const context = readerContextKey.value;
  const book = currentBook.value;
  const chapter = currentChapter.value;
  await loadReadingDetail(tongdokPlanId.value, book, chapter);
  if (context !== readerContextKey.value || (audioSource && audioSource.audioContextKey !== audioContextKey.value)) return;
  // 버튼 클릭은 그날 일정 전체를 완료한다. 오디오 종료는 현재 장만 완료한다.
  if (!audioSource) markAllScheduleChapters();
  const result = await completeCurrentChapter(book, chapter);
  progressRevision.value++;
  if (!pageActive || context !== readerContextKey.value || result.status === 'stale-context') return;
  if (result.status === 'out-of-range') { toast.info('오늘 일정 범위 밖의 장이에요'); return; }
  if (result.status === 'busy') return;
  if (!result.ok) { toast.error('완료 처리에 실패했습니다'); return; }
  if (!audioSource) toast.success(`${currentBookName.value} ${chapter}${chapterSuffix.value} 통독 완료`);
  if (result.scheduleCompleted && result.planId && result.selectedScheduleId) {
    const scheduleId = result.persistedScheduleIds.at(-1) ?? result.selectedScheduleId;
    await openCompletion(context, result.planId, scheduleId);
  }
};

// 헬퍼: 사용자 데이터 로딩 (인증된 사용자 전용)
const loadUserDataForChapter = async (book: string, chapter: number, skipReadChapters = false) => {
  await auth.initialize();
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

const enterReaderMode = async (book: string, chapter: number) => navigateReader(book, chapter);
const handleContinueReading = async () => {
  const lastPos = await loadReadingPosition();
  if (lastPos) {
    await navigateReader(lastPos.book, lastPos.chapter, undefined, lastPos.version || 'GAE');
    await restoreSavedScrollPosition(lastPos.scroll_position);
  } else {
    await enterReaderMode(currentBook.value, currentChapter.value);
  }
};
const handleHomeBookSelect = (bookId: string, chapter = 1) => enterReaderMode(bookId, chapter);
const handleTocBookSelect = (bookId: string, chapter = 1) => enterReaderMode(bookId, chapter);
const handleTocBack = () => { viewMode.value = 'home'; };

let pendingResumeScroll: number | null = null;

const applyReaderRoute = async (restorePosition = false) => {
  const generation = ++routeGeneration;
  const wasAudioOpen = showTongdokAudioPlayer.value;
  await saveCurrentReadingPosition(true);
  readerReady.value = false;
  showTongdokAudioPlayer.value = false;
  showShareSheet.value = false;
  showGuideSheet.value = false;
  showScheduleModal.value = false;
  nextSchedule.value = null;
  await modal.close(completionModalId);
  initTongdokMode();
  if (!getBibleRouteQueryPolicy(route.query).shouldInitializeOnEntry) {
    // 북마크: 진입 쿼리가 없으면 마지막 읽은 위치로 자동 복귀한다.
    if (restorePosition) {
      const last = await loadReadingPosition();
      if (pageActive && generation === routeGeneration && last) {
        pendingResumeScroll = last.scroll_position;
        await navigateReader(last.book, last.chapter, undefined, last.version || 'GAE');
        return;
      }
    }
    viewMode.value = 'home';
    ++contentGeneration;
    return;
  }
  viewMode.value = 'reader';
  initFromQuery();
  resetReaderScrollPosition();
  const book = currentBook.value;
  const chapter = currentChapter.value;
  const [lastPosition] = await Promise.all([
    restorePosition && !pendingVerseFocus.value ? loadReadingPosition() : Promise.resolve(null),
    loadBibleContent(book, chapter),
    loadUserDataForChapter(book, chapter, isTongdokMode.value),
    loadReadingDetail(isTongdokMode.value ? tongdokPlanId.value : null, book, chapter),
  ]);
  if (!pageActive || generation !== routeGeneration) return;
  if (pendingResumeScroll !== null) {
    const resumeScroll = pendingResumeScroll;
    pendingResumeScroll = null;
    await restoreSavedScrollPosition(resumeScroll);
  } else if (lastPosition?.book === book && lastPosition.chapter === chapter && lastPosition.version === currentVersion.value) {
    await restoreSavedScrollPosition(lastPosition.scroll_position);
  } else {
    await focusPendingVerseRange();
  }
  readerReady.value = true;
  // 오디오가 켜진 채로 장을 넘기면 새 장의 오디오를 이어서 연다.
  if (wasAudioOpen && tongdokAudioLink.value) showTongdokAudioPlayer.value = true;
  enablePositionSaving();
};
onMounted(async () => {
  try {
    const saved = JSON.parse(localStorage.getItem('bibleCompare') || '{}');
    if (typeof saved.secondaryVersion === 'string' && saved.secondaryVersion in VISIBLE_VERSION_NAMES) secondaryVersion.value = saved.secondaryVersion;
    else secondaryVersion.value = currentVersion.value === 'GAE' ? 'KNT' : 'GAE';
    compareEnabled.value = saved.enabled === true;
  } catch (error) { console.warn('Failed to load compare preferences:', error); }
  routeLoad = applyReaderRoute(true);
  await routeLoad;
  if (pageActive) window.addEventListener('beforeunload', handleBeforeUnload);
});
onBeforeUnmount(() => {
  void saveCurrentReadingPosition(true);
  pageActive = false;
  ++routeGeneration;
  ++contentGeneration;
  ++secondaryGeneration;
  cleanupReadingPosition();
  void modal.close(completionModalId);
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
const handleBeforeUnload = () => { void saveCurrentReadingPosition(true); };
watch(() => route.query, () => {
  routeLoad = applyReaderRoute();
  return routeLoad;
});
watch(() => auth.user.value?.id, async () => {
  clearReadChapters();
  chapterHighlights.value = [];
  if (viewMode.value === 'reader') await loadUserDataForChapter(currentBook.value, currentChapter.value);
});
// Content-affecting preferences need reparsing; typography itself is live in BibleViewer.
watch(() => [readingSettingsStore.settings.showFootnotes, readingSettingsStore.settings.showDescription,
  readingSettingsStore.settings.showCrossRef], async () => {
  compareChapters.clear();
  if (viewMode.value === 'reader') await Promise.all([loadBibleContent(currentBook.value, currentChapter.value), loadSecondaryContent()]);
});
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

.bible-page.is-reader {
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}

@media (min-width: 1024px) {
  .bible-page {
    max-width: calc(var(--content-max) + var(--sidebar-width));
    padding-inline-start: var(--sidebar-width);
  }
}

/* 다크모드 */
:root.dark .bible-page {
  background: var(--color-bg-primary);
}
</style>
