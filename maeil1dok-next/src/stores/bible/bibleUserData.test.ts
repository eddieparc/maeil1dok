import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBibleUserDataStore, bibleUserDataSelectors } from './bibleUserData'
import type { BibleUserDataState } from './bibleUserData'

vi.mock('zustand')

const mockBookmark = {
  id: 1,
  bookmark_type: 'chapter' as const,
  book: 'gen',
  chapter: 1,
  title: '창세기 1장',
  created_at: '2026-01-01T00:00:00Z',
}

const mockHighlight = {
  id: 1,
  book: 'gen',
  chapter: 1,
  start_verse: 1,
  end_verse: 3,
  color: '#FFD700',
  created_at: '2026-01-01T00:00:00Z',
}

const mockNote = {
  id: 1,
  book: 'gen',
  chapter: 1,
  content: '창세기 1장 묵상',
  is_private: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('BibleUserData Store', () => {
  let store: ReturnType<typeof createBibleUserDataStore>

  beforeEach(() => {
    store = createBibleUserDataStore()
  })

  describe('초기 상태', () => {
    it('빈 배열로 시작', () => {
      const state = store.getState()
      expect(state.bookmarks).toHaveLength(0)
      expect(state.highlights).toHaveLength(0)
      expect(state.notes).toHaveLength(0)
    })

    it('로딩 상태 false로 시작', () => {
      const state = store.getState()
      expect(state.isLoadingBookmarks).toBe(false)
      expect(state.isLoadingHighlights).toBe(false)
      expect(state.isLoadingNotes).toBe(false)
    })
  })

  describe('Bookmark CRUD', () => {
    it('북마크 추가', () => {
      store.getState().addBookmark(mockBookmark)
      expect(store.getState().bookmarks).toHaveLength(1)
      expect(store.getState().bookmarks[0]?.id).toBe(1)
    })

    it('북마크 삭제', () => {
      store.getState().addBookmark(mockBookmark)
      store.getState().removeBookmark(1)
      expect(store.getState().bookmarks).toHaveLength(0)
    })

    it('북마크 목록 설정', () => {
      store.getState().setBookmarks([mockBookmark, { ...mockBookmark, id: 2, chapter: 2 }])
      expect(store.getState().bookmarks).toHaveLength(2)
    })

    it('isBookmarked - 북마크된 장', () => {
      store.getState().addBookmark(mockBookmark)
      expect(store.getState().isBookmarked('gen', 1)).toBe(true)
    })

    it('isBookmarked - 북마크 없는 장', () => {
      expect(store.getState().isBookmarked('gen', 1)).toBe(false)
    })

    it('isBookmarked - 다른 책/장', () => {
      store.getState().addBookmark(mockBookmark)
      expect(store.getState().isBookmarked('exo', 1)).toBe(false)
      expect(store.getState().isBookmarked('gen', 2)).toBe(false)
    })
  })

  describe('Highlight CRUD', () => {
    it('하이라이트 추가', () => {
      store.getState().addHighlight(mockHighlight)
      expect(store.getState().highlights).toHaveLength(1)
    })

    it('하이라이트 삭제', () => {
      store.getState().addHighlight(mockHighlight)
      store.getState().removeHighlight(1)
      expect(store.getState().highlights).toHaveLength(0)
    })

    it('하이라이트 업데이트', () => {
      store.getState().addHighlight(mockHighlight)
      store.getState().updateHighlight(1, { color: '#FF0000' })
      expect(store.getState().highlights[0]?.color).toBe('#FF0000')
    })

    it('getHighlightsByChapter', () => {
      store.getState().addHighlight(mockHighlight)
      store.getState().addHighlight({ ...mockHighlight, id: 2, chapter: 2 })
      const result = store.getState().getHighlightsByChapter('gen', 1)
      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe(1)
    })
  })

  describe('Note CRUD', () => {
    it('노트 추가', () => {
      store.getState().addNote(mockNote)
      expect(store.getState().notes).toHaveLength(1)
    })

    it('노트 삭제', () => {
      store.getState().addNote(mockNote)
      store.getState().removeNote(1)
      expect(store.getState().notes).toHaveLength(0)
    })

    it('노트 업데이트', () => {
      store.getState().addNote(mockNote)
      store.getState().updateNote(1, { content: '수정된 묵상' })
      expect(store.getState().notes[0]?.content).toBe('수정된 묵상')
    })

    it('getNotesByChapter', () => {
      store.getState().addNote(mockNote)
      store.getState().addNote({ ...mockNote, id: 2, chapter: 2 })
      const result = store.getState().getNotesByChapter('gen', 1)
      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe(1)
    })
  })

  describe('Loading state', () => {
    it('북마크 로딩 상태 설정', () => {
      store.getState().setLoadingBookmarks(true)
      expect(store.getState().isLoadingBookmarks).toBe(true)
      store.getState().setLoadingBookmarks(false)
      expect(store.getState().isLoadingBookmarks).toBe(false)
    })

    it('하이라이트 로딩 상태 설정', () => {
      store.getState().setLoadingHighlights(true)
      expect(store.getState().isLoadingHighlights).toBe(true)
    })

    it('노트 로딩 상태 설정', () => {
      store.getState().setLoadingNotes(true)
      expect(store.getState().isLoadingNotes).toBe(true)
    })
  })

  describe('reset', () => {
    it('모든 상태 초기화', () => {
      store.getState().addBookmark(mockBookmark)
      store.getState().addHighlight(mockHighlight)
      store.getState().addNote(mockNote)
      store.getState().reset()
      const state = store.getState()
      expect(state.bookmarks).toHaveLength(0)
      expect(state.highlights).toHaveLength(0)
      expect(state.notes).toHaveLength(0)
    })
  })

  describe('bibleUserDataSelectors', () => {
    it('bookmarksByChapter selector', () => {
      const state = {
        bookmarks: [mockBookmark, { ...mockBookmark, id: 2, chapter: 2 }],
        highlights: [],
        notes: [],
      } as unknown as BibleUserDataState
      const result = bibleUserDataSelectors.bookmarksByChapter(state, 'gen', 1)
      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe(1)
    })

    it('isChapterBookmarked selector', () => {
      const state = {
        bookmarks: [mockBookmark],
        highlights: [],
        notes: [],
      } as unknown as BibleUserDataState
      expect(bibleUserDataSelectors.isChapterBookmarked(state, 'gen', 1)).toBe(true)
      expect(bibleUserDataSelectors.isChapterBookmarked(state, 'gen', 2)).toBe(false)
    })
  })
})
