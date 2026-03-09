import { useCallback, useState } from 'react'
import type { HighlightColor } from '@/types'

/* ===== Types ===== */
export type CopyType = 'includeLocation' | 'numOnly' | 'textOnly' | 'includeLocationRange' | 'excludeLocationRange'
export type MenuMode = 'copy' | 'action'

export interface UseVerseInteractionParams {
  book: string
  bookName: string
  chapter: number
  version: string
  chapterText: string
  selectedVerseRange: { start: number; end: number } | null
  currentHighlight: { id: string } | null
  onVerseClick: (verse: number) => void
  clearSelection: () => void
  createHighlight: (verse: number, color: HighlightColor) => Promise<void>
  deleteHighlight: (id: string) => Promise<void>
}

export interface UseVerseInteractionReturn {
  isMenuOpen: boolean
  menuMode: MenuMode
  menuPosition: { x: number; y: number } | undefined
  selectedText: string
  selectedVerseNumbers: number[]
  handleVerseTap: (payload: {
    interaction: 'tap' | 'selection'
    text: string
    verseNumber?: number
    startVerse?: number
    endVerse?: number
    position?: { x: number; y: number }
  }) => void
  handleCopyByType: (copyType: CopyType) => Promise<void>
  handleHighlightSelect: (color: HighlightColor) => Promise<void>
  handleRemoveHighlight: () => Promise<void>
  handleShare: () => Promise<void>
  closeMenu: () => void
}

/* ===== Helpers ===== */
function inferVerseNumber(text: string): number | null {
  const match = text.match(/^\s*(\d{1,3})\b/)
  return match ? Number(match[1]) : null
}

/* ===== Hook ===== */
export function useVerseInteraction(params: UseVerseInteractionParams): UseVerseInteractionReturn {
  const {
    book,
    bookName,
    chapter,
    version,
    chapterText,
    selectedVerseRange,
    currentHighlight,
    onVerseClick,
    clearSelection,
    createHighlight,
    deleteHighlight,
  } = params

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuMode, setMenuMode] = useState<MenuMode>('copy')
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | undefined>(undefined)
  const [selectedText, setSelectedText] = useState('')
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([])

  const handleVerseTap = useCallback((payload: {
    interaction: 'tap' | 'selection'
    text: string
    verseNumber?: number
    startVerse?: number
    endVerse?: number
    position?: { x: number; y: number }
  }) => {
    if (payload.interaction === 'selection') {
      const start = payload.startVerse
      const end = payload.endVerse

      if (typeof start === 'number' && typeof end === 'number') {
        onVerseClick(start)
        setSelectedVerseNumbers(Array.from({ length: end - start + 1 }, (_, index) => start + index))
      }

      setSelectedText(payload.text)
      setMenuMode('action')
      setMenuPosition(payload.position)
      setIsMenuOpen(true)
      return
    }

    const verseNumber = typeof payload.verseNumber === 'number' ? payload.verseNumber : inferVerseNumber(payload.text)
    if (verseNumber !== null) {
      onVerseClick(verseNumber)
      setSelectedVerseNumbers([verseNumber])
    } else {
      clearSelection()
      setSelectedVerseNumbers([])
    }

    setSelectedText(payload.text || chapterText)
    setMenuMode('copy')
    setMenuPosition(payload.position)
    setIsMenuOpen(true)
  }, [chapterText, clearSelection, onVerseClick])

  const handleCopyByType = useCallback(async (copyType: CopyType) => {
    const numbers = selectedVerseNumbers.length > 0 ? selectedVerseNumbers : selectedVerseRange ? [selectedVerseRange.start] : []
    const start = numbers[0]
    const end = numbers[numbers.length - 1]
    let textToCopy = selectedText.trim()

    if (!start) {
      textToCopy = chapterText
    } else if (copyType === 'includeLocation') {
      textToCopy = `[${bookName}${chapter}:${start}] ${selectedText}`
    } else if (copyType === 'numOnly') {
      textToCopy = `${start} ${selectedText}`
    } else if (copyType === 'includeLocationRange' && end) {
      textToCopy = `[${bookName}${chapter}:${start}-${end}]\n${selectedText}`
    } else if (copyType === 'excludeLocationRange') {
      textToCopy = selectedText
    }

    await navigator.clipboard.writeText(textToCopy).catch(() => undefined)
    setIsMenuOpen(false)
  }, [bookName, chapter, chapterText, selectedText, selectedVerseNumbers, selectedVerseRange])

  const handleHighlightSelect = useCallback(async (color: HighlightColor) => {
    if (!selectedVerseRange) {
      return
    }

    const tasks: Promise<void>[] = []
    for (let verse = selectedVerseRange.start; verse <= selectedVerseRange.end; verse += 1) {
      tasks.push(createHighlight(verse, color))
    }

    await Promise.all(tasks)
  }, [createHighlight, selectedVerseRange])

  const handleRemoveHighlight = useCallback(async () => {
    if (!currentHighlight) {
      return
    }

    await deleteHighlight(currentHighlight.id)
  }, [currentHighlight, deleteHighlight])

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/bible?book=${book}&chapter=${chapter}&version=${version}`
    const title = `${bookName} ${chapter}장`
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined)
      return
    }

    await navigator.clipboard.writeText(url).catch(() => undefined)
  }, [book, bookName, chapter, version])

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  return {
    isMenuOpen,
    menuMode,
    menuPosition,
    selectedText,
    selectedVerseNumbers,
    handleVerseTap,
    handleCopyByType,
    handleHighlightSelect,
    handleRemoveHighlight,
    handleShare,
    closeMenu,
  }
}
