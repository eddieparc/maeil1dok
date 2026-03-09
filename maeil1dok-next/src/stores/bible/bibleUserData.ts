'use client'

import { createStoreFactory, type StateCreator } from '@/lib/zustand/factory'
import { createStoreContext } from '@/lib/zustand/provider'
import type { Bookmark, Note, Highlight } from '@/lib/bible/types'

// ============================================
// Types
// ============================================

interface BibleUserDataData {
  bookmarks: Bookmark[]
  highlights: Highlight[]
  notes: Note[]
  isLoadingBookmarks: boolean
  isLoadingHighlights: boolean
  isLoadingNotes: boolean
}

interface BibleUserDataActions {
  // Bookmark actions
  setBookmarks: (bookmarks: Bookmark[]) => void
  addBookmark: (bookmark: Bookmark) => void
  removeBookmark: (id: number) => void
  isBookmarked: (book: string, chapter: number) => boolean

  // Highlight actions
  setHighlights: (highlights: Highlight[]) => void
  addHighlight: (highlight: Highlight) => void
  removeHighlight: (id: number) => void
  updateHighlight: (id: number, updates: Partial<Highlight>) => void
  getHighlightsByChapter: (book: string, chapter: number) => Highlight[]

  // Note actions
  setNotes: (notes: Note[]) => void
  addNote: (note: Note) => void
  removeNote: (id: number) => void
  updateNote: (id: number, updates: Partial<Note>) => void
  getNotesByChapter: (book: string, chapter: number) => Note[]

  // Loading state actions
  setLoadingBookmarks: (loading: boolean) => void
  setLoadingHighlights: (loading: boolean) => void
  setLoadingNotes: (loading: boolean) => void

  // Reset
  reset: () => void
}

export type BibleUserDataState = BibleUserDataData & BibleUserDataActions

// ============================================
// Selectors
// ============================================

export const bibleUserDataSelectors = {
  bookmarksByChapter: (state: BibleUserDataState, book: string, chapter: number): Bookmark[] =>
    state.bookmarks.filter((b) => b.book === book && b.chapter === chapter),

  highlightsByChapter: (state: BibleUserDataState, book: string, chapter: number): Highlight[] =>
    state.highlights.filter((h) => h.book === book && h.chapter === chapter),

  notesByChapter: (state: BibleUserDataState, book: string, chapter: number): Note[] =>
    state.notes.filter((n) => n.book === book && n.chapter === chapter),

  isChapterBookmarked: (state: BibleUserDataState, book: string, chapter: number): boolean =>
    state.bookmarks.some(
      (b) => b.book === book && b.chapter === chapter && b.bookmark_type === 'chapter'
    ),
}

// ============================================
// Store Factory
// ============================================

const initialState: BibleUserDataData = {
  bookmarks: [],
  highlights: [],
  notes: [],
  isLoadingBookmarks: false,
  isLoadingHighlights: false,
  isLoadingNotes: false,
}

export const createBibleUserDataStore = createStoreFactory<BibleUserDataState>(
  ((set, get) => ({
    ...initialState,

    // ── Bookmark actions ──────────────────────────────────────────────
    setBookmarks: (bookmarks) => set({ bookmarks }),

    addBookmark: (bookmark) =>
      set((state) => ({ bookmarks: [...state.bookmarks, bookmark] })),

    removeBookmark: (id) =>
      set((state) => ({ bookmarks: state.bookmarks.filter((b) => b.id !== id) })),

    isBookmarked: (book, chapter) =>
      bibleUserDataSelectors.isChapterBookmarked(get(), book, chapter),

    // ── Highlight actions ─────────────────────────────────────────────
    setHighlights: (highlights) => set({ highlights }),

    addHighlight: (highlight) =>
      set((state) => ({ highlights: [...state.highlights, highlight] })),

    removeHighlight: (id) =>
      set((state) => ({ highlights: state.highlights.filter((h) => h.id !== id) })),

    updateHighlight: (id, updates) =>
      set((state) => ({
        highlights: state.highlights.map((h) =>
          h.id === id ? { ...h, ...updates } : h
        ),
      })),

    getHighlightsByChapter: (book, chapter) =>
      bibleUserDataSelectors.highlightsByChapter(get(), book, chapter),

    // ── Note actions ──────────────────────────────────────────────────
    setNotes: (notes) => set({ notes }),

    addNote: (note) =>
      set((state) => ({ notes: [...state.notes, note] })),

    removeNote: (id) =>
      set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),

    updateNote: (id, updates) =>
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, ...updates } : n
        ),
      })),

    getNotesByChapter: (book, chapter) =>
      bibleUserDataSelectors.notesByChapter(get(), book, chapter),

    // ── Loading state ─────────────────────────────────────────────────
    setLoadingBookmarks: (loading) => set({ isLoadingBookmarks: loading }),
    setLoadingHighlights: (loading) => set({ isLoadingHighlights: loading }),
    setLoadingNotes: (loading) => set({ isLoadingNotes: loading }),

    // ── Reset ─────────────────────────────────────────────────────────
    reset: () => set(initialState),
  })) as StateCreator<BibleUserDataState>
)

// ============================================
// Context
// ============================================

export const {
  StoreProvider: BibleUserDataProvider,
  useStoreContext: useBibleUserData,
  useStoreApi: useBibleUserDataApi,
} = createStoreContext<BibleUserDataState>()
