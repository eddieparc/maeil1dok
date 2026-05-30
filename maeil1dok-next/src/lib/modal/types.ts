import type { ReactNode } from 'react'
import type { BibleVersion } from '@/lib/bible/books'
import type { HighlightColor } from '@/types/highlight'

export enum BibleModalId {
  BOOK_SELECTOR = 'BOOK_SELECTOR',
  VERSION_SELECTOR = 'VERSION_SELECTOR',
  TONGDOK_COMPLETE = 'TONGDOK_COMPLETE',
  TONGDOK_ALREADY_COMPLETE = 'TONGDOK_ALREADY_COMPLETE',
  TONGDOK_NEXT_SCHEDULE = 'TONGDOK_NEXT_SCHEDULE',
  NOTE_MODAL = 'NOTE_MODAL',
  NOTE_QUICK = 'NOTE_QUICK',
  HIGHLIGHT_MODAL = 'HIGHLIGHT_MODAL',
  SETTINGS_MODAL = 'SETTINGS_MODAL',
}

export type ModalId = BibleModalId

export interface BookSelectorModalData {
  currentBook?: string
  currentChapter?: number
  currentVersion?: BibleVersion
}

export interface VersionSelectorModalData {
  currentVersion?: BibleVersion
}

export interface TongdokCompleteModalData {
  scheduleRange: string
  initialAutoComplete?: boolean
  isLoading?: boolean
  isCelebrating?: boolean
}

export interface TongdokAlreadyCompleteModalData {
  scheduleRange: string
  isLoading?: boolean
}

export interface TongdokNextScheduleModalData {
  scheduleRange: string
  nextScheduleText?: string
  isLoading?: boolean
}

export interface NoteModalData {
  book: string
  chapter: number
  verseStart?: number
  verseEnd?: number
  noteId?: string
}

export interface NoteQuickModalData {
  book: string
  chapter: number
  verse?: number
}

export interface HighlightModalData {
  book: string
  chapter: number
  startVerse: number
  endVerse: number
  selectedColor?: HighlightColor
}

export interface SettingsModalData {
  initialSection?: 'typography' | 'reading-mode'
}

export interface BibleModalDataMap {
  [BibleModalId.BOOK_SELECTOR]: BookSelectorModalData | undefined
  [BibleModalId.VERSION_SELECTOR]: VersionSelectorModalData | undefined
  [BibleModalId.TONGDOK_COMPLETE]: TongdokCompleteModalData
  [BibleModalId.TONGDOK_ALREADY_COMPLETE]: TongdokAlreadyCompleteModalData
  [BibleModalId.TONGDOK_NEXT_SCHEDULE]: TongdokNextScheduleModalData
  [BibleModalId.NOTE_MODAL]: NoteModalData
  [BibleModalId.NOTE_QUICK]: NoteQuickModalData
  [BibleModalId.HIGHLIGHT_MODAL]: HighlightModalData
  [BibleModalId.SETTINGS_MODAL]: SettingsModalData | undefined
}

type ModalDescriptor<TId extends BibleModalId> = undefined extends BibleModalDataMap[TId]
  ? { id: TId; data?: BibleModalDataMap[TId] }
  : { id: TId; data: BibleModalDataMap[TId] }

export type BibleModalData = {
  [TId in BibleModalId]: ModalDescriptor<TId>
}[BibleModalId]

export type ModalData = BibleModalData

export type BibleActiveModal<TId extends BibleModalId = BibleModalId> = Extract<BibleModalData, { id: TId }>

export interface BibleModalComponentProps<TId extends BibleModalId = BibleModalId> {
  modal: BibleActiveModal<TId>
  isOpen: boolean
  closeModal: () => void
}

export interface BibleModalState {
  activeModal: BibleModalData | null
  openModal: (modal: BibleModalData) => void
  closeModal: () => void
}

export type ModalState = BibleModalState

export interface BibleModalStoreApi {
  getState: () => BibleModalState
  subscribe: (listener: () => void) => () => void
}

export interface BibleModalHostProps {
  store: BibleModalStoreApi
  fallback?: ReactNode
  renderPlaceholder?: (modal: BibleModalData, closeModal: () => void) => ReactNode
}
