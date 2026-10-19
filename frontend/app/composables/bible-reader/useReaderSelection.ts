import type { Ref } from 'vue';
import type { SelectionCopyFormat } from '~/components/bible/SelectionFloatingControls.vue';
import type BibleViewer from '~/components/bible/BibleViewer.vue';

// Selection menu handlers — all delegate to the inner BibleViewer instance.
export const useReaderSelection = (bibleViewerRef: Ref<InstanceType<typeof BibleViewer> | null>) => {
  const handleSelectionHighlightOrRemove = () => {
    bibleViewerRef.value?.handleHighlightOrRemove();
  };

  const handleSelectionCopy = () => {
    bibleViewerRef.value?.handleCopy();
  };

  const handleSelectionShare = () => {
    bibleViewerRef.value?.handleShare();
  };

  const handleSelectionClose = () => {
    bibleViewerRef.value?.clearAllSelections();
  };

  const handleSelectionCopyWithFormat = (format: SelectionCopyFormat) => {
    bibleViewerRef.value?.handleClickCopy(format);
  };

  const handleSelectionCopyClose = () => {
    bibleViewerRef.value?.clearClickSelection();
  };

  return {
    handleSelectionHighlightOrRemove,
    handleSelectionCopy,
    handleSelectionShare,
    handleSelectionClose,
    handleSelectionCopyWithFormat,
    handleSelectionCopyClose,
  };
};
