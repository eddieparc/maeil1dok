import { describe, it, expect, beforeEach } from 'vitest'
import { createBiblePageStateStore, biblePageSelectors } from './biblePageState'
import type { BiblePageState } from './biblePageState'
import type { StoreApi } from 'zustand'

describe('BiblePageState Store', () => {
  let store: StoreApi<BiblePageState>

  beforeEach(() => {
    store = createBiblePageStateStore()
  })

  it('initializes with default state', () => {
    const state = store.getState()

    expect(state.currentBook).toBe('gen')
    expect(state.currentChapter).toBe(1)
    expect(state.currentVersion).toBe('GAE')
    expect(state.viewMode).toBe('home')
  })

  it("returns '편' suffix for Psalms", () => {
    store.getState().selectBook('psa')

    expect(biblePageSelectors.chapterSuffix(store.getState())).toBe('편')
  })

  it('moves from Genesis 50 to Exodus 1', () => {
    store.getState().selectBook('gen')
    store.getState().selectChapter(50)
    store.getState().goToNextChapter()

    expect(store.getState().currentBook).toBe('exo')
    expect(store.getState().currentChapter).toBe(1)
  })

  it('returns hasNextChapter=false at Revelation 22', () => {
    store.getState().selectBook('rev')
    store.getState().selectChapter(22)

    expect(biblePageSelectors.hasNextChapter(store.getState())).toBe(false)
  })

  it('keeps state unchanged when next at Revelation 22', () => {
    store.getState().selectBook('rev')
    store.getState().selectChapter(22)

    store.getState().goToNextChapter()

    expect(store.getState().currentBook).toBe('rev')
    expect(store.getState().currentChapter).toBe(22)
  })

  it('returns hasPrevChapter=false at Genesis 1', () => {
    store.getState().selectBook('gen')
    store.getState().selectChapter(1)

    expect(biblePageSelectors.hasPrevChapter(store.getState())).toBe(false)
  })

  it('keeps state unchanged when previous at Genesis 1', () => {
    store.getState().selectBook('gen')
    store.getState().selectChapter(1)

    store.getState().goToPrevChapter()

    expect(store.getState().currentBook).toBe('gen')
    expect(store.getState().currentChapter).toBe(1)
  })

  it('switches view modes', () => {
    store.getState().setViewMode('reader')
    expect(store.getState().viewMode).toBe('reader')

    store.getState().setViewMode('toc')
    expect(store.getState().viewMode).toBe('toc')
  })
})
