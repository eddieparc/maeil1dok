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
    expect(state.viewMode).toBe('reader')
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

  it('parses tongdok params from query', () => {
    store.getState().initFromQuery({
      tongdok: 'true',
      schedule: '123',
      plan: '1',
      book: 'gen',
      chapter: '2',
    })

    const state = store.getState()
    expect(state.currentBook).toBe('gen')
    expect(state.currentChapter).toBe(2)
    expect(state.pendingTongdokParams).toEqual({
      tongdok: true,
      scheduleId: '123',
      planId: 1,
    })
  })

  it('parses plan param without tongdok flag', () => {
    store.getState().initFromQuery({
      plan: '5',
      book: 'exo',
      chapter: '3',
    })

    const state = store.getState()
    expect(state.currentBook).toBe('exo')
    expect(state.currentChapter).toBe(3)
    expect(state.pendingTongdokParams).toEqual({
      tongdok: false,
      scheduleId: null,
      planId: 5,
    })
  })

  it('does not set pendingTongdokParams when no tongdok or plan param', () => {
    store.getState().initFromQuery({
      book: 'mat',
      chapter: '5',
    })

    const state = store.getState()
    expect(state.currentBook).toBe('mat')
    expect(state.currentChapter).toBe(5)
    expect(state.pendingTongdokParams).toBeNull()
  })
})
