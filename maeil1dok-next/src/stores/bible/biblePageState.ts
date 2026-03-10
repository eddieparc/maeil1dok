'use client'

import { persist } from 'zustand/middleware'
import { createStoreFactory, type StateCreator } from '@/lib/zustand/factory'
import { createStoreContext } from '@/lib/zustand/provider'
import {
  BIBLE_BOOKS,
  BIBLE_BOOK_ORDER,
  BIBLE_VERSIONS,
  isBibleVersion,
  type BibleVersion,
} from '@/lib/bible/books'
import type { ViewMode, ChapterSuffix } from '@/types/bible'

// ============================================
// Types
// ============================================

interface BiblePageStateData {
  currentBook: string
  currentChapter: number
  currentVersion: BibleVersion
  viewMode: ViewMode
  pendingTongdokParams: {
    tongdok: boolean
    scheduleId: string | null
    planId: number | null
  } | null
}

interface BiblePageStateActions {
  selectBook: (book: string) => void
  selectChapter: (chapter: number) => void
  selectVersion: (version: BibleVersion) => void
  setViewMode: (mode: ViewMode) => void
  goToPrevChapter: () => void
  goToNextChapter: () => void
  initFromQuery: (params: Record<string, string>) => void
  generateShareUrl: () => string
}

export type BiblePageState = BiblePageStateData & BiblePageStateActions

const DEFAULT_BOOK = 'gen'
const DEFAULT_CHAPTER = 1
const DEFAULT_VERSION: BibleVersion = 'GAE'
const DEFAULT_VIEW_MODE: ViewMode = 'reader'

function isValidBook(book: string): book is keyof typeof BIBLE_BOOKS {
  return book in BIBLE_BOOKS
}

function getBookOrderIndex(book: string): number {
  return BIBLE_BOOK_ORDER.indexOf(book as typeof BIBLE_BOOK_ORDER[number])
}

// ============================================
// Selectors
// ============================================

export const biblePageSelectors = {
  currentBookName: (state: BiblePageState): string =>
    BIBLE_BOOKS[state.currentBook]?.ko ?? state.currentBook,

  currentVersionName: (state: BiblePageState): string =>
    BIBLE_VERSIONS[state.currentVersion] ?? state.currentVersion,

  maxChapters: (state: BiblePageState): number =>
    BIBLE_BOOKS[state.currentBook]?.chapters ?? 1,

  chapterSuffix: (state: BiblePageState): ChapterSuffix =>
    state.currentBook === 'psa' ? '편' : '장',

  hasPrevChapter: (state: BiblePageState): boolean => {
    if (state.currentChapter > 1) return true
    const idx = getBookOrderIndex(state.currentBook)
    return idx > 0
  },

  hasNextChapter: (state: BiblePageState): boolean => {
    const maxChapters = BIBLE_BOOKS[state.currentBook]?.chapters ?? 1
    if (state.currentChapter < maxChapters) return true
    const idx = getBookOrderIndex(state.currentBook)
    return idx > -1 && idx < BIBLE_BOOK_ORDER.length - 1
  },
}

// ============================================
// Store Factory
// ============================================

export const createBiblePageStateStore = createStoreFactory<BiblePageState>(
  persist(
    (set, get) => ({
      currentBook: DEFAULT_BOOK,
      currentChapter: DEFAULT_CHAPTER,
      currentVersion: DEFAULT_VERSION,
      viewMode: DEFAULT_VIEW_MODE,
      pendingTongdokParams: null,

      selectBook: (book: string) => {
        if (!isValidBook(book)) return
        const maxChapters = BIBLE_BOOKS[book]?.chapters ?? 1
        set((state) => ({
          currentBook: book,
          currentChapter: Math.min(Math.max(state.currentChapter, 1), maxChapters),
        }))
      },

      selectChapter: (chapter: number) => {
        if (!Number.isInteger(chapter) || chapter < 1) return
        const maxChapters = BIBLE_BOOKS[get().currentBook]?.chapters ?? 1
        set({ currentChapter: Math.min(chapter, maxChapters) })
      },

      selectVersion: (version: BibleVersion) => {
        set({ currentVersion: version })
      },

      setViewMode: (mode: ViewMode) => {
        set({ viewMode: mode })
      },

      goToPrevChapter: () => {
        const { currentBook, currentChapter } = get()
        if (currentChapter > 1) {
          set({ currentChapter: currentChapter - 1 })
          return
        }
        const idx = getBookOrderIndex(currentBook)
        if (idx <= 0) return
        const prevBook = BIBLE_BOOK_ORDER[idx - 1]
        if (!prevBook || !isValidBook(prevBook)) return
        set({
          currentBook: prevBook,
          currentChapter: BIBLE_BOOKS[prevBook]?.chapters ?? 1,
        })
      },

      goToNextChapter: () => {
        const { currentBook, currentChapter } = get()
        const maxChapters = BIBLE_BOOKS[currentBook]?.chapters ?? 1
        if (currentChapter < maxChapters) {
          set({ currentChapter: currentChapter + 1 })
          return
        }
        const idx = getBookOrderIndex(currentBook)
        if (idx < 0 || idx >= BIBLE_BOOK_ORDER.length - 1) return
        const nextBook = BIBLE_BOOK_ORDER[idx + 1]
        if (!nextBook || !isValidBook(nextBook)) return
        set({ currentBook: nextBook, currentChapter: 1 })
      },

      initFromQuery: (params: Record<string, string>) => {
        const { book, chapter, version, tongdok, schedule, plan } = params
        if (book && isValidBook(book)) {
          set({ currentBook: book })

          if (chapter) {
            const chapterNum = Number.parseInt(chapter, 10)
            if (Number.isInteger(chapterNum) && chapterNum > 0) {
              const maxChapters = BIBLE_BOOKS[book].chapters
              set({ currentChapter: Math.min(chapterNum, maxChapters) })
            }
          }
        } else if (chapter) {
          const chapterNum = Number.parseInt(chapter, 10)
          if (Number.isInteger(chapterNum) && chapterNum > 0) {
            const maxChapters = BIBLE_BOOKS[get().currentBook]?.chapters ?? 1
            set({ currentChapter: Math.min(chapterNum, maxChapters) })
          }
        }
        if (version && isBibleVersion(version)) {
          set({ currentVersion: version })
        }

        // Handle tongdok, schedule, plan parameters
        if (tongdok === 'true' || plan) {
          const planId = plan ? Number.parseInt(plan, 10) : null
          const scheduleId = schedule ?? null
          set({
            pendingTongdokParams: {
              tongdok: tongdok === 'true',
              scheduleId,
              planId: typeof planId === 'number' && planId > 0 ? planId : null,
            },
          })
        }
      },

      generateShareUrl: () => {
        const { currentBook, currentChapter, currentVersion } = get()
        return `/bible?book=${currentBook}&chapter=${currentChapter}&version=${currentVersion}`
      },
    }),
    {
      name: 'bible-page-state',
      partialize: (state) => ({
        currentBook: state.currentBook,
        currentChapter: state.currentChapter,
        currentVersion: state.currentVersion,
        // pendingTongdokParams is intentionally excluded from persistence
      }),
    }
  ) as StateCreator<BiblePageState>
)

// ============================================
// Context
// ============================================

const _biblePageStateContext = createStoreContext<BiblePageState>()
export const BiblePageStateProvider = _biblePageStateContext.StoreProvider
export const useBiblePageState = _biblePageStateContext.useStoreContext
export const useBiblePageStateApi = _biblePageStateContext.useStoreApi
