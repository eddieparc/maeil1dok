'use client'

import { useCallback } from 'react'
import {
  BibleModalId,
  type BibleModalData,
  type BibleModalDataMap,
  type BibleModalState,
} from '@/lib/modal/types'
import { createStoreFactory } from '@/lib/zustand/factory'
import { createStoreContext } from '@/lib/zustand/provider'

type BookSelectorModalPayload = BibleModalDataMap[BibleModalId.BOOK_SELECTOR]

type VersionSelectorModalPayload = BibleModalDataMap[BibleModalId.VERSION_SELECTOR]

type TongdokCompleteModalPayload =
  BibleModalDataMap[BibleModalId.TONGDOK_COMPLETE]

type TongdokAlreadyCompleteModalPayload =
  BibleModalDataMap[BibleModalId.TONGDOK_ALREADY_COMPLETE]

type TongdokNextScheduleModalPayload =
  BibleModalDataMap[BibleModalId.TONGDOK_NEXT_SCHEDULE]

type NoteModalPayload = BibleModalDataMap[BibleModalId.NOTE_MODAL]

type NoteQuickModalPayload = BibleModalDataMap[BibleModalId.NOTE_QUICK]

type HighlightModalPayload = BibleModalDataMap[BibleModalId.HIGHLIGHT_MODAL]

type SettingsModalPayload = BibleModalDataMap[BibleModalId.SETTINGS_MODAL]

// ============================================
// Store Factory
// ============================================

export const createBibleModalsStore = createStoreFactory<BibleModalState>(
  (set) => ({
    activeModal: null,
    openModal: (modal) => set({ activeModal: modal }),
    closeModal: () => set({ activeModal: null }),
  })
)

export type BibleModalsStoreApi = ReturnType<typeof createBibleModalsStore>

// ============================================
// Context
// ============================================

export const {
  StoreProvider: BibleModalsProvider,
  useStoreContext: useBibleModals,
  useStoreApi: useBibleModalsApi,
} = createStoreContext<BibleModalState>()

export function useActiveBibleModal() {
  return useBibleModals((state) => state.activeModal)
}

export function useIsBibleModalOpen(modalId: BibleModalId) {
  return useBibleModals((state) => state.activeModal?.id === modalId)
}

export function useOpenBibleModal() {
  const store = useBibleModalsApi()

  return useCallback(
    (modal: BibleModalData) => {
      store.getState().openModal(modal)
    },
    [store]
  )
}

export function useCloseBibleModal() {
  const store = useBibleModalsApi()

  return useCallback(() => {
    store.getState().closeModal()
  }, [store])
}

export function useOpenBookSelector() {
  const openModal = useOpenBibleModal()

  return useCallback(
    (data?: BookSelectorModalPayload) => {
      openModal({ id: BibleModalId.BOOK_SELECTOR, data })
    },
    [openModal]
  )
}

export function useOpenVersionSelector() {
  const openModal = useOpenBibleModal()

  return useCallback(
    (data?: VersionSelectorModalPayload) => {
      openModal({ id: BibleModalId.VERSION_SELECTOR, data })
    },
    [openModal]
  )
}

export function useOpenTongdokCompleteModal() {
  const openModal = useOpenBibleModal()

  return useCallback(
    (data: TongdokCompleteModalPayload) => {
      openModal({ id: BibleModalId.TONGDOK_COMPLETE, data })
    },
    [openModal]
  )
}

export function useOpenTongdokAlreadyCompleteModal() {
  const openModal = useOpenBibleModal()

  return useCallback(
    (data: TongdokAlreadyCompleteModalPayload) => {
      openModal({ id: BibleModalId.TONGDOK_ALREADY_COMPLETE, data })
    },
    [openModal]
  )
}

export function useOpenTongdokNextScheduleModal() {
  const openModal = useOpenBibleModal()

  return useCallback(
    (data: TongdokNextScheduleModalPayload) => {
      openModal({ id: BibleModalId.TONGDOK_NEXT_SCHEDULE, data })
    },
    [openModal]
  )
}

export function useOpenNoteModal() {
  const openModal = useOpenBibleModal()

  return useCallback(
    (data: NoteModalPayload) => {
      openModal({ id: BibleModalId.NOTE_MODAL, data })
    },
    [openModal]
  )
}

export function useOpenNoteQuickModal() {
  const openModal = useOpenBibleModal()

  return useCallback(
    (data: NoteQuickModalPayload) => {
      openModal({ id: BibleModalId.NOTE_QUICK, data })
    },
    [openModal]
  )
}

export function useOpenHighlightModal() {
  const openModal = useOpenBibleModal()

  return useCallback(
    (data: HighlightModalPayload) => {
      openModal({ id: BibleModalId.HIGHLIGHT_MODAL, data })
    },
    [openModal]
  )
}

export function useOpenSettingsModal() {
  const openModal = useOpenBibleModal()

  return useCallback(
    (data?: SettingsModalPayload) => {
      openModal({ id: BibleModalId.SETTINGS_MODAL, data })
    },
    [openModal]
  )
}
