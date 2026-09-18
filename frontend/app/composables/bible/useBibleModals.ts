/**
 * useBibleModals - Bible 페이지 모달 상태 관리
 *
 * 5개의 개별 모달 상태를 단일 진입점으로 통합 관리합니다.
 * 현재는 모달 간 상호 배타성을 강제하지 않습니다 (기존 동작 유지).
 *
 * @example
 * const modals = useBibleModals();
 *
 * // 모달 열기
 * modals.openBookSelector();
 *
 * // 모달 닫기 (v-model 또는 직접)
 * modals.closeBookSelector();
 *
 * // 하이라이트 모달은 선택 범위와 함께 열기
 * modals.openHighlightModal({ start: 1, end: 3 });
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';

/**
 * 하이라이트 선택 범위
 */
export interface HighlightSelection {
  start: number;
  end: number;
}

/**
 * useBibleModals 반환 타입
 */
export interface UseBibleModalsReturn {
  // 상태 (Refs)
  showBookSelector: Ref<boolean>;
  showTongdokCompleteModal: Ref<boolean>;
  showNoteModal: Ref<boolean>;
  showHighlightModal: Ref<boolean>;
  showSettingsModal: Ref<boolean>;
  highlightSelection: Ref<HighlightSelection | null>;

  // 액션
  openBookSelector: () => void;
  closeBookSelector: () => void;
  openTongdokCompleteModal: () => void;
  closeTongdokCompleteModal: () => void;
  openNoteModal: () => void;
  closeNoteModal: () => void;
  openHighlightModal: (selection: HighlightSelection) => void;
  closeHighlightModal: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  closeAllModals: () => void;

  // Computed (선택적 사용)
  isAnyModalOpen: ComputedRef<boolean>;
}

/**
 * Bible 페이지 모달 상태 관리 composable
 */
export function useBibleModals(): UseBibleModalsReturn {
  // ============================================
  // State
  // ============================================

  const showBookSelector = ref(false);
  const showTongdokCompleteModal = ref(false);
  const showNoteModal = ref(false);
  const showHighlightModal = ref(false);
  const showSettingsModal = ref(false);

  // 하이라이트 선택 범위 (하이라이트 모달과 함께 사용)
  const highlightSelection = ref<HighlightSelection | null>(null);

  // ============================================
  // Computed
  // ============================================

  const isAnyModalOpen = computed(() =>
    showBookSelector.value ||
    showTongdokCompleteModal.value ||
    showNoteModal.value ||
    showHighlightModal.value ||
    showSettingsModal.value
  );

  // ============================================
  // Actions
  // ============================================

  // Book Selector
  const openBookSelector = () => {
    showBookSelector.value = true;
  };

  const closeBookSelector = () => {
    showBookSelector.value = false;
  };

  // Tongdok Complete Modal
  const openTongdokCompleteModal = () => {
    showTongdokCompleteModal.value = true;
  };

  const closeTongdokCompleteModal = () => {
    showTongdokCompleteModal.value = false;
  };

  // Note Modal
  const openNoteModal = () => {
    showNoteModal.value = true;
  };

  const closeNoteModal = () => {
    showNoteModal.value = false;
  };

  // Highlight Modal (선택 범위 포함)
  const openHighlightModal = (selection: HighlightSelection) => {
    highlightSelection.value = { start: selection.start, end: selection.end };
    showHighlightModal.value = true;
  };

  const closeHighlightModal = () => {
    showHighlightModal.value = false;
    // 선택 범위는 모달이 닫힐 때 초기화하지 않음 (기존 동작 유지)
    // 필요시 highlightSelection.value = null; 추가 가능
  };

  // Settings Modal
  const openSettingsModal = () => {
    showSettingsModal.value = true;
  };

  const closeSettingsModal = () => {
    showSettingsModal.value = false;
  };

  // 모든 모달 닫기
  const closeAllModals = () => {
    showBookSelector.value = false;
    showTongdokCompleteModal.value = false;
    showNoteModal.value = false;
    showHighlightModal.value = false;
    showSettingsModal.value = false;
  };

  // ============================================
  // Return
  // ============================================

  return {
    // State
    showBookSelector,
    showTongdokCompleteModal,
    showNoteModal,
    showHighlightModal,
    showSettingsModal,
    highlightSelection,

    // Actions
    openBookSelector,
    closeBookSelector,
    openTongdokCompleteModal,
    closeTongdokCompleteModal,
    openNoteModal,
    closeNoteModal,
    openHighlightModal,
    closeHighlightModal,
    openSettingsModal,
    closeSettingsModal,
    closeAllModals,

    // Computed
    isAnyModalOpen,
  };
}
