import type { StoreApi } from 'zustand'
import { beforeEach, describe, expect, it } from 'vitest'
import { BibleModalId, type BibleModalState } from '../../lib/modal/types'
import { createBibleModalsStore } from './bibleModals'

describe('createBibleModalsStore', () => {
  let store: StoreApi<BibleModalState>

  beforeEach(() => {
    store = createBibleModalsStore()
  })

  it('초기 상태에서 activeModal이 null이다', () => {
    expect(store.getState().activeModal).toBeNull()
  })

  it('BOOK_SELECTOR 모달을 연다', () => {
    store.getState().openModal({
      id: BibleModalId.BOOK_SELECTOR,
      data: { currentBook: 'gen', currentChapter: 1 },
    })

    expect(store.getState().activeModal?.id).toBe(BibleModalId.BOOK_SELECTOR)
  })

  it('closeModal로 activeModal을 null로 되돌린다', () => {
    store.getState().openModal({
      id: BibleModalId.BOOK_SELECTOR,
      data: { currentBook: 'gen', currentChapter: 1 },
    })

    store.getState().closeModal()

    expect(store.getState().activeModal).toBeNull()
  })

  it('HIGHLIGHT_MODAL 데이터를 그대로 저장한다', () => {
    store.getState().openModal({
      id: BibleModalId.HIGHLIGHT_MODAL,
      data: { book: 'gen', chapter: 1, startVerse: 1, endVerse: 3 },
    })

    expect(store.getState().activeModal).toEqual({
      id: BibleModalId.HIGHLIGHT_MODAL,
      data: { book: 'gen', chapter: 1, startVerse: 1, endVerse: 3 },
    })
  })

  it('새 모달을 열면 마지막 모달로 교체된다', () => {
    store.getState().openModal({
      id: BibleModalId.BOOK_SELECTOR,
      data: { currentBook: 'gen', currentChapter: 1 },
    })
    store.getState().openModal({
      id: BibleModalId.VERSION_SELECTOR,
      data: { currentVersion: 'GAE' },
    })

    expect(store.getState().activeModal).toEqual({
      id: BibleModalId.VERSION_SELECTOR,
      data: { currentVersion: 'GAE' },
    })
  })

  it('다른 모달 데이터를 가진 상태에서도 closeModal이 null로 초기화한다', () => {
    store.getState().openModal({
      id: BibleModalId.HIGHLIGHT_MODAL,
      data: { book: 'gen', chapter: 1, startVerse: 1, endVerse: 3 },
    })

    store.getState().closeModal()

    expect(store.getState().activeModal).toBeNull()
  })
})
