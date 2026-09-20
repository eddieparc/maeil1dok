import type { Ref } from 'vue';
import type { ResolvedViewerProps, ViewerEmit } from './types';
import type { VerseSelection } from './useVerseSelection';

// 선택된 절에 대한 액션(복사/공유/하이라이트) 핸들러.
// getCopyText는 BibleViewer.vue에 남긴다 — 그 본문의 인덱싱 오류가
// typecheck-baseline.json에 파일 경로별로 고정되어 있어 이동하면 래칫이 깨진다.
export function useVerseActions(
  viewerRef: Ref<HTMLElement | null>,
  props: ResolvedViewerProps,
  emit: ViewerEmit,
  selection: VerseSelection,
  getCopyText: (type: string) => string,
) {
  const {
    clickSelectedStart,
    clickSelectedEnd,
    clickSelectedVerses,
    selectedVerses,
    selectionMode,
    showCopyMenu,
    getSelectionPayload,
    getSelectedVerseHighlight,
    emitSelectionMenuChange,
    clearAllSelections,
    hideActionMenu,
  } = selection;

  // 절 클릭 복사 핸들러
  const writeCopyText = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Keep the older-browser fallback, but never report a failed copy as success.
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      try {
        textarea.select();
        if (!document.execCommand('copy')) throw new Error('Clipboard copy failed');
      } catch (error) {
        emit('copy-error', error);
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    }
    emit('copy', text);
    return true;
  };

  const handleClickCopy = async (type: string) => {
    const text = getCopyText(type);
    if (!text) return;
    const selectionSnapshot = selectedVerses.value;
    const copied = await writeCopyText(text);
    if (copied && selectionSnapshot === selectedVerses.value) clearAllSelections();
  };

  // 액션 핸들러
  const handleHighlight = () => {
    const payload = getSelectionPayload();
    if (!payload) return;
    emit('highlight', payload);
    clearAllSelections();
  };

  // Saving remains with the authenticated page/service owner, not this text viewer.
  const handleHighlightColor = (color: string) => {
    const payload = getSelectionPayload();
    if (!payload) return;
    const existing = getSelectedVerseHighlight();
    emit('highlight-save', { ...payload, color, ...(existing ? { highlightId: existing.id } : {}) });
    clearAllSelections();
  };

  // 하이라이트 추가 또는 제거 핸들러
  const handleHighlightOrRemove = () => {
    const existingHighlight = getSelectedVerseHighlight();
    if (existingHighlight) {
      // 기존 하이라이트가 있으면 삭제 이벤트 발생
      emit('highlight-delete', existingHighlight.id);
      hideActionMenu();
      clearAllSelections();
    } else {
      // 하이라이트 추가
      handleHighlight();
    }
  };

  const handleCopy = async () => {
    // 복사 버튼은 즉시 복사하지 않고 형식 메뉴(위치 포함/절 번호만/내용만)를 연다.
    hideActionMenu();
    if (!clickSelectedVerses.value.length) {
      // 드래그 선택을 클릭 선택 형식으로 변환해 형식 메뉴가 동작하게 한다.
      const { start, end } = selectedVerses.value;
      if (!start) return;
      clickSelectedStart.value = start;
      clickSelectedEnd.value = start === end ? null : end;
      const versesArray: Array<{ number: number; text: string }> = [];
      viewerRef.value?.querySelectorAll('.verse').forEach((el) => {
        const nEl = el.querySelector('.verse-number');
        const tEl = el.querySelector('.verse-text');
        if (!nEl || !tEl) return;
        const n = parseInt(nEl.textContent?.trim() || '0', 10);
        if (n >= start && n <= end) versesArray.push({ number: n, text: tEl.textContent?.trim() || '' });
      });
      clickSelectedVerses.value = versesArray;
      selectionMode.value = 'click';
    }
    showCopyMenu.value = true;
    emitSelectionMenuChange();
  };

  const handleShare = () => {
    const payload = getSelectionPayload();
    if (!payload) return;
    emit('share', { ...payload, startVerse: payload.start, endVerse: payload.end });
    clearAllSelections();
  };

  return {
    writeCopyText,
    handleClickCopy,
    handleHighlight,
    handleHighlightColor,
    handleHighlightOrRemove,
    handleCopy,
    handleShare,
  };
}
