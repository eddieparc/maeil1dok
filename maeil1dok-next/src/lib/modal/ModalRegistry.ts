import { createElement, lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { BibleModalId, type BibleModalComponentProps } from './types'

export type ModalRegistryStatus = 'ready' | 'placeholder'

export type ModalComponent<TId extends BibleModalId = BibleModalId> = ComponentType<BibleModalComponentProps<TId>>

export interface BibleModalRegistryEntry<TId extends BibleModalId = BibleModalId> {
  id: TId
  displayName: string
  status: ModalRegistryStatus
  component: LazyExoticComponent<ModalComponent<TId>>
}

export type ModalRegistry = {
  [TId in BibleModalId]: BibleModalRegistryEntry<TId>
}

function createReadyEntry<TId extends BibleModalId>(
  id: TId,
  displayName: string,
  loader: () => Promise<{ default: ModalComponent<TId> }>,
): BibleModalRegistryEntry<TId> {
  return {
    id,
    displayName,
    status: 'ready',
    component: lazy(loader),
  }
}

function createPlaceholderEntry<TId extends BibleModalId>(
  id: TId,
  displayName: string,
): BibleModalRegistryEntry<TId> {
  const PlaceholderComponent: ModalComponent<TId> = () => null

  return {
    id,
    displayName,
    status: 'placeholder',
    component: lazy(async () => ({ default: PlaceholderComponent })),
  }
}

export const MODAL_REGISTRY: ModalRegistry = {
  [BibleModalId.BOOK_SELECTOR]: createReadyEntry(BibleModalId.BOOK_SELECTOR, 'BookSelector', async () => {
    const module = await import('@/components/bible/BookSelector')

    const ModalComponent: ModalComponent<BibleModalId.BOOK_SELECTOR> = ({ modal, isOpen, closeModal }) =>
      createElement(module.default, {
        isOpen,
        onClose: closeModal,
        currentBook: modal.data?.currentBook,
        currentChapter: modal.data?.currentChapter,
        onSelect: (_book: string, _chapter: number, _verse?: number) => {
          closeModal()
        },
      })

    return { default: ModalComponent }
  }),
  [BibleModalId.VERSION_SELECTOR]: createPlaceholderEntry(BibleModalId.VERSION_SELECTOR, 'VersionSelector'),
  [BibleModalId.TONGDOK_COMPLETE]: createReadyEntry(BibleModalId.TONGDOK_COMPLETE, 'TongdokCompleteModal', async () => {
    const module = await import('@/components/bible/TongdokCompleteModal')

    const ModalComponent: ModalComponent<BibleModalId.TONGDOK_COMPLETE> = ({ modal, isOpen, closeModal }) =>
      createElement(module.default, {
        isOpen,
        onClose: closeModal,
        scheduleRange: modal.data.scheduleRange,
        initialAutoComplete: modal.data.initialAutoComplete,
        isLoading: modal.data.isLoading,
        isCelebrating: modal.data.isCelebrating,
        onConfirm: (_autoComplete: boolean) => {
          closeModal()
        },
      })

    return { default: ModalComponent }
  }),
  [BibleModalId.TONGDOK_ALREADY_COMPLETE]: createReadyEntry(BibleModalId.TONGDOK_ALREADY_COMPLETE, 'TongdokAlreadyCompleteModal', async () => {
    const module = await import('@/components/bible/TongdokAlreadyCompleteModal')

    const ModalComponent: ModalComponent<BibleModalId.TONGDOK_ALREADY_COMPLETE> = ({ modal, isOpen, closeModal }) =>
      createElement(module.default, {
        isOpen,
        onClose: closeModal,
        scheduleRange: modal.data.scheduleRange,
        isLoading: modal.data.isLoading,
        onAction: () => {
          closeModal()
        },
      })

    return { default: ModalComponent }
  }),
  [BibleModalId.TONGDOK_NEXT_SCHEDULE]: createReadyEntry(BibleModalId.TONGDOK_NEXT_SCHEDULE, 'TongdokNextScheduleModal', async () => {
    const module = await import('@/components/bible/TongdokNextScheduleModal')

    const ModalComponent: ModalComponent<BibleModalId.TONGDOK_NEXT_SCHEDULE> = ({ modal, isOpen, closeModal }) =>
      createElement(module.default, {
        isOpen,
        onClose: closeModal,
        scheduleRange: modal.data.scheduleRange,
        nextScheduleText: modal.data.nextScheduleText,
        isLoading: modal.data.isLoading,
        onAction: () => {
          closeModal()
        },
      })

    return { default: ModalComponent }
  }),
  [BibleModalId.NOTE_MODAL]: createPlaceholderEntry(BibleModalId.NOTE_MODAL, 'NoteModal'),
  [BibleModalId.NOTE_QUICK]: createReadyEntry(BibleModalId.NOTE_QUICK, 'NoteQuickModal', async () => {
    const module = await import('@/components/bible/NoteQuickModal')

    const ModalComponent: ModalComponent<BibleModalId.NOTE_QUICK> = ({ modal, isOpen, closeModal }) =>
      createElement(module.default, {
        isOpen,
        onClose: closeModal,
        book: modal.data.book,
        chapter: modal.data.chapter,
        verse: modal.data.verse,
        onSave: (_content: string) => {
          closeModal()
        },
      })

    return { default: ModalComponent }
  }),
  [BibleModalId.HIGHLIGHT_MODAL]: createReadyEntry(BibleModalId.HIGHLIGHT_MODAL, 'HighlightModal', async () => {
    const module = await import('@/components/bible/HighlightModal')

    const ModalComponent: ModalComponent<BibleModalId.HIGHLIGHT_MODAL> = ({ modal, isOpen, closeModal }) =>
      createElement(module.default, {
        isOpen,
        onClose: closeModal,
        book: modal.data.book,
        chapter: modal.data.chapter,
        startVerse: modal.data.startVerse,
        endVerse: modal.data.endVerse,
        selectedColor: modal.data.selectedColor,
        onSave: (_color: string, _memo?: string) => {
          closeModal()
        },
      })

    return { default: ModalComponent }
  }),
  [BibleModalId.SETTINGS_MODAL]: createReadyEntry(BibleModalId.SETTINGS_MODAL, 'ReadingSettingsModal', async () => {
    const module = await import('@/components/bible/ReadingSettingsModal')

    const ModalComponent: ModalComponent<BibleModalId.SETTINGS_MODAL> = ({ isOpen, closeModal }) =>
      createElement(module.default, {
        isOpen,
        onClose: closeModal,
      })

    return { default: ModalComponent }
  }),
}

export function getModalRegistryEntry<TId extends BibleModalId>(id: TId): BibleModalRegistryEntry<TId> {
  return MODAL_REGISTRY[id]
}

export function getModalComponent<TId extends BibleModalId>(id: TId): LazyExoticComponent<ModalComponent<TId>> {
  return getModalRegistryEntry(id).component
}
