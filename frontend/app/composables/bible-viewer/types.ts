// BibleViewer의 선택/액션 계약 타입.
// BibleViewer.vue가 type-only로 재수출하므로 기존
// `import type ... from '~/components/bible/BibleViewer.vue'` 호출부는 그대로 동작한다.

export interface Highlight {
  id: number;
  start_verse: number;
  end_verse: number;
  color: string;
  memo?: string;
}

export interface VerseSelectionPayload {
  book: string;
  chapter: number;
  version: string;
  start: number;
  end: number;
  text: string;
  verses: Array<{ number: number; text: string }>;
}

export interface SelectionHighlightPayload extends VerseSelectionPayload {
  color: string;
  highlightId?: number;
}

export interface SelectionMenuState {
  visible: boolean;
  mode: 'action' | 'copy' | null;
  isHighlighted: boolean;
  isSingleVerse: boolean;
  highlightColor?: string | null;
  selection?: VerseSelectionPayload | null;
}

export interface SelectionSharePayload extends Partial<VerseSelectionPayload> {
  text: string;
  startVerse: number;
  endVerse: number;
}

// withDefaults 적용 후 컴포저블이 받는 해석된 형태.
// (컴포넌트의 defineProps는 로컬 interface를 쓴다 — 테스트 하네스의
// compileScript가 fs 없이 실행되어 import된 타입을 해석하지 못한다.)
export interface ResolvedViewerProps {
  content: string;
  book: string;
  chapter: number;
  version: string;
  isLoading: boolean;
  initialScrollPosition: number;
  highlights: Highlight[];
}

// 컴포저블이 emit을 받을 때 쓰는 시그니처. 컴포넌트의 defineEmits 선언과
// `const emit: ViewerEmit = defineEmits<...>` 대입으로 drift를 타입체크가 잡는다.
export type ViewerEmit = {
  (event: 'scroll', position: number): void;
  (event: 'scroll-pixels', position: number): void;
  (event: 'verse-select', verses: VerseSelectionPayload): void;
  (event: 'highlight-save', payload: SelectionHighlightPayload): void;
  (event: 'bookmark', verses: { start: number; end: number; text: string }): void;
  (event: 'highlight', verses: { start: number; end: number; text: string }): void;
  (event: 'highlight-delete', highlightId: number): void;
  (event: 'copy', text: string): void;
  (event: 'copy-error', error: unknown): void;
  (event: 'share', payload: SelectionSharePayload): void;
  (event: 'selection-menu-change', state: SelectionMenuState): void;
  (event: 'swipe-left'): void;
  (event: 'swipe-right'): void;
};
