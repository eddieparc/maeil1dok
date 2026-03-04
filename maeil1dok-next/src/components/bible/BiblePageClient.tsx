'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useBiblePageState } from '@/hooks/bible/useBiblePageState'
import { usePersonalRecord } from '@/hooks/bible/usePersonalRecord'
import { isBibleVersion } from '@/lib/bible/books'

import BibleHome from './BibleHome'
import BibleTOC from './BibleTOC'
import BibleReaderView from './BibleReaderView'
import BookSelector from './BookSelector'
import NoteQuickModal from './NoteQuickModal'
import HighlightModal from './HighlightModal'
import ReadingSettingsModal from './ReadingSettingsModal'
import PlanSelectorModal from './PlanSelectorModal'
import Container from '@/components/ui/Container'

interface BiblePageClientProps {
  initialBook?: string
  initialChapter?: number
  initialVersion?: string
}

interface LastPosition {
  book: string
  chapter: number
}

function loadLastPosition(): LastPosition | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('lastReadingPosition')
    if (!stored) return null
    const parsed = JSON.parse(stored) as { book?: string; chapter?: number }
    if (!parsed.book || !parsed.chapter) return null
    return { book: parsed.book, chapter: parsed.chapter }
  } catch {
    return null
  }
}

export default function BiblePageClient({ initialBook, initialChapter, initialVersion }: BiblePageClientProps) {
  const router = useRouter()
  const pageState = useBiblePageState()
  const { markAsRead } = usePersonalRecord(pageState.currentBook)

  const [lastPosition, setLastPosition] = useState<LastPosition | null>(null)

  // Modal visibility state
  const [showBookSelector, setShowBookSelector] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showHighlightModal, setShowHighlightModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)

  // Deep link parsing on mount
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const pos = loadLastPosition()
    setLastPosition(pos)

    if (initialBook ?? initialChapter ?? initialVersion) {
      const params: Record<string, string> = {}
      if (initialBook) params.book = initialBook
      if (initialChapter) params.chapter = String(initialChapter)
      if (initialVersion) params.version = initialVersion
      pageState.initFromQuery(params)
      router.replace('/bible')
      pageState.setViewMode('reader')
    }
  }, []) 

  const handleSelectBookChapter = useCallback((book: string, chapter: number) => {
    pageState.selectBook(book)
    pageState.selectChapter(chapter)
    pageState.setViewMode('reader')
    setShowBookSelector(false)
  }, [pageState])

  const handleMarkAsRead = useCallback(async () => {
    await markAsRead(pageState.currentChapter)
    pageState.goToNextChapter()
  }, [markAsRead, pageState])

  const handleTOCSelectBook = useCallback((book: string) => {
    pageState.selectBook(book)
    pageState.selectChapter(1)
    pageState.setViewMode('reader')
  }, [pageState])

  const version = isBibleVersion(pageState.currentVersion) ? pageState.currentVersion : 'GAE'

  return (
    <>
      <Container fullHeight className="max-w-2xl pb-24">
        {pageState.viewMode === 'home' && (
          <BibleHome
            lastPosition={lastPosition ?? undefined}
            onContinueReading={(book, chapter) => {
              pageState.selectBook(book)
              pageState.selectChapter(chapter)
              pageState.setViewMode('reader')
            }}
            onSelectBook={(book, chapter) => {
              pageState.selectBook(book)
              pageState.selectChapter(chapter)
              pageState.setViewMode('reader')
            }}
            onViewTOC={() => pageState.setViewMode('toc')}
          />
        )}

        {pageState.viewMode === 'toc' && (
          <BibleTOC
            currentBook={pageState.currentBook}
            onSelectBook={handleTOCSelectBook}
            onBack={() => pageState.setViewMode('home')}
          />
        )}

        {pageState.viewMode === 'reader' && (
          <BibleReaderView
            book={pageState.currentBook}
            chapter={pageState.currentChapter}
            version={version}
            onPrevChapter={pageState.goToPrevChapter}
            onNextChapter={pageState.goToNextChapter}
            onOpenBookSelector={() => setShowBookSelector(true)}
            onOpenNoteModal={() => setShowNoteModal(true)}
            onOpenHighlightModal={() => setShowHighlightModal(true)}
            onOpenSettingsModal={() => setShowSettingsModal(true)}
            onMarkAsRead={() => void handleMarkAsRead()}
          />
        )}
      </Container>

      <BookSelector
        isOpen={showBookSelector}
        onClose={() => setShowBookSelector(false)}
        onSelect={handleSelectBookChapter}
        currentBook={pageState.currentBook}
        currentChapter={pageState.currentChapter}
      />

      <NoteQuickModal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        book={pageState.currentBook}
        chapter={pageState.currentChapter}
        onSave={async (content, isPrivate) => {
          await fetch('/api/bible/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              book: pageState.currentBook,
              chapter: pageState.currentChapter,
              content,
              is_private: isPrivate,
            }),
          })
        }}
      />

      <HighlightModal
        isOpen={showHighlightModal}
        onClose={() => setShowHighlightModal(false)}
        onSave={(color, memo) => {
          void fetch('/api/bible/highlights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              book: pageState.currentBook,
              chapter: pageState.currentChapter,
              color,
              memo,
              version,
            }),
          })
        }}
      />

      <ReadingSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      <PlanSelectorModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSelectPlan={(planId) => {
          void fetch('/api/bible/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId }),
          })
        }}
      />
    </>
  )
}
