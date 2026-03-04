'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useBiblePageState } from '@/hooks/bible/useBiblePageState'
import { usePersonalRecord } from '@/hooks/bible/usePersonalRecord'
import { useTongdokMode } from '@/hooks/bible/useTongdokMode'
import { useConfetti } from '@/hooks/useConfetti'
import { isBibleVersion } from '@/lib/bible/books'
import { BIBLE_BOOKS } from '@/lib/bible/books'

import BibleHome from './BibleHome'
import BibleTOC from './BibleTOC'
import BibleReaderView from './BibleReaderView'
import BookSelector from './BookSelector'
import NoteQuickModal from './NoteQuickModal'
import HighlightModal from './HighlightModal'
import BookmarkModal from './BookmarkModal'
import ReadingSettingsModal from './ReadingSettingsModal'
import PlanSelectorModal from './PlanSelectorModal'
import TongdokCompleteModal from './TongdokCompleteModal'
import TongdokAlreadyCompleteModal, { type TongdokAlreadyCompleteAction } from './TongdokAlreadyCompleteModal'
import TongdokNextScheduleModal, { type TongdokNextScheduleAction } from './TongdokNextScheduleModal'
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

interface NextTongdokSchedule {
  id: string
  planId: string
  book: string
  chapter: number
  date: string
}

function formatTongdokRange(
  book: string,
  chapter: number,
  range: ReturnType<ReturnType<typeof useTongdokMode>['getTongdokScheduleRange']>,
) {
  if (!range) {
    return `${BIBLE_BOOKS[book]?.ko ?? book} ${chapter}장`
  }

  const startBook = BIBLE_BOOKS[range.startBook]?.ko ?? range.startBook
  const endBook = BIBLE_BOOKS[range.endBook]?.ko ?? range.endBook
  return `${startBook} ${range.startChapter}장 - ${endBook} ${range.endChapter}장`
}

function formatNextScheduleText(book: string, chapter: number, date: string) {
  const bookName = BIBLE_BOOKS[book]?.ko ?? book
  if (!date) {
    return `${bookName} ${chapter}장`
  }

  return `${date} · ${bookName} ${chapter}장`
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
  const { fireConfetti } = useConfetti()
  const {
    tongdokMode,
    tongdokPlanId,
    enableTongdokMode,
    disableTongdokMode,
    loadReadingDetail,
    getTongdokScheduleRange,
    getTongdokProgress,
    getAudioLink,
    getGuideLink,
    isScheduleCompleted,
    completeReading,
    getNextScheduleSuggestion,
  } = useTongdokMode()

  const [lastPosition, setLastPosition] = useState<LastPosition | null>(null)

  // Modal visibility state
  const [showBookSelector, setShowBookSelector] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showHighlightModal, setShowHighlightModal] = useState(false)
  const [showBookmarkModal, setShowBookmarkModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showTongdokCompleteModal, setShowTongdokCompleteModal] = useState(false)
  const [showTongdokAlreadyCompleteModal, setShowTongdokAlreadyCompleteModal] = useState(false)
  const [showTongdokNextScheduleModal, setShowTongdokNextScheduleModal] = useState(false)
  const [tongdokCelebrating, setTongdokCelebrating] = useState(false)
  const [tongdokLoading, setTongdokLoading] = useState(false)
  const [nextTongdokSchedule, setNextTongdokSchedule] = useState<NextTongdokSchedule | null>(null)

  // Deep link parsing on mount
  const initialized = useRef(false)
  useEffect(() => {
    if (!tongdokMode || !tongdokPlanId) {
      return
    }

    void loadReadingDetail(tongdokPlanId)
  }, [loadReadingDetail, tongdokMode, tongdokPlanId])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const pos = loadLastPosition()
    setLastPosition(pos)

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tongdok = params.get('tongdok')
      const schedule = params.get('schedule')
      const plan = params.get('plan')
      if (tongdok === 'true' && schedule && plan) {
        enableTongdokMode(schedule, plan)
      }
    }

    if (initialBook ?? initialChapter ?? initialVersion) {
      const params: Record<string, string> = {}
      if (initialBook) params.book = initialBook
      if (initialChapter) params.chapter = String(initialChapter)
      if (initialVersion) params.version = initialVersion
      pageState.initFromQuery(params)
      router.replace('/bible')
      pageState.setViewMode('reader')
    }
  }, [enableTongdokMode, initialBook, initialChapter, initialVersion, pageState, router])

  const goToNextTongdokSchedule = useCallback((nextSchedule: NextTongdokSchedule) => {
    enableTongdokMode(nextSchedule.id, nextSchedule.planId)
    pageState.selectBook(nextSchedule.book)
    pageState.selectChapter(nextSchedule.chapter)
    pageState.setViewMode('reader')
  }, [enableTongdokMode, pageState])

  const handleSelectBookChapter = useCallback((book: string, chapter: number) => {
    pageState.selectBook(book)
    pageState.selectChapter(chapter)
    pageState.setViewMode('reader')
    setShowBookSelector(false)
  }, [pageState])

  const handleMarkAsRead = useCallback(async () => {
    if (tongdokMode) {
      if (isScheduleCompleted()) {
        setShowTongdokAlreadyCompleteModal(true)
        return
      }

      setShowTongdokCompleteModal(true)
      return
    }

    await markAsRead(pageState.currentChapter)
    pageState.goToNextChapter()
  }, [isScheduleCompleted, markAsRead, pageState, tongdokMode])

  const handleTongdokCompleteConfirm = useCallback(async (_autoComplete: boolean) => {
    setTongdokLoading(true)
    const nextSchedule = getNextScheduleSuggestion()
    const completed = await completeReading()

    if (!completed) {
      setTongdokLoading(false)
      return
    }

    setTongdokCelebrating(true)
    fireConfetti()
    setNextTongdokSchedule(nextSchedule)

    window.setTimeout(() => {
      setTongdokCelebrating(false)
      setShowTongdokCompleteModal(false)
      if (nextSchedule) {
        setShowTongdokNextScheduleModal(true)
      }
      setTongdokLoading(false)
    }, 900)
  }, [completeReading, fireConfetti, getNextScheduleSuggestion])

  const handleAlreadyCompleteAction = useCallback(async (action: TongdokAlreadyCompleteAction) => {
    if (action === 'cancel') {
      return
    }

    if (action === 'go-next') {
      const nextSchedule = getNextScheduleSuggestion()
      if (nextSchedule) {
        setNextTongdokSchedule(nextSchedule)
        goToNextTongdokSchedule(nextSchedule)
      }
      setShowTongdokAlreadyCompleteModal(false)
      return
    }

    setTongdokLoading(true)
    const nextSchedule = getNextScheduleSuggestion()
    const completed = await completeReading()
    if (!completed) {
      setTongdokLoading(false)
      return
    }

    fireConfetti()
    setShowTongdokAlreadyCompleteModal(false)
    setNextTongdokSchedule(nextSchedule)
    if (nextSchedule) {
      setShowTongdokNextScheduleModal(true)
    }
    setTongdokLoading(false)
  }, [completeReading, fireConfetti, getNextScheduleSuggestion, goToNextTongdokSchedule])

  const handleNextScheduleAction = useCallback((action: TongdokNextScheduleAction) => {
    if (action === 'go-next-schedule' && nextTongdokSchedule) {
      goToNextTongdokSchedule(nextTongdokSchedule)
    }

    setShowTongdokNextScheduleModal(false)
  }, [goToNextTongdokSchedule, nextTongdokSchedule])

  const tongdokRange = getTongdokScheduleRange()
  const tongdokProgress = getTongdokProgress()
  const tongdokRangeText = formatTongdokRange(pageState.currentBook, pageState.currentChapter, tongdokRange)
  const audioLink = getAudioLink(pageState.currentBook, pageState.currentChapter)
  const guideLink = getGuideLink(pageState.currentBook, pageState.currentChapter)

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
            onOpenHighlightModal={() => setShowHighlightModal(true)}
            onOpenBookmarkModal={() => setShowBookmarkModal(true)}
            onOpenSettingsModal={() => setShowSettingsModal(true)}
            onMarkAsRead={() => void handleMarkAsRead()}
            tongdokMode={tongdokMode}
            tongdokRangeText={tongdokRangeText}
            tongdokProgress={tongdokProgress}
            onDisableTongdokMode={disableTongdokMode}
            audioLink={audioLink}
            guideLink={guideLink}
            onAudioLinkClick={(url) => {
              window.open(url, '_blank', 'noopener,noreferrer')
            }}
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
        onSave={async (content) => {
          await fetch('/api/bible/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              book: pageState.currentBook,
              chapter: pageState.currentChapter,
              content,
              is_private: false,
            }),
          })
        }}
      />

      <BookmarkModal
        isOpen={showBookmarkModal}
        onClose={() => setShowBookmarkModal(false)}
        book={pageState.currentBook}
        chapter={pageState.currentChapter}
        onSave={async ({ title, color, memo }) => {
          await fetch('/api/bible/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookmark_type: 'chapter',
              book: pageState.currentBook,
              chapter: pageState.currentChapter,
              title,
              color,
              memo,
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

      <TongdokCompleteModal
        isOpen={showTongdokCompleteModal}
        onClose={() => setShowTongdokCompleteModal(false)}
        scheduleRange={tongdokRangeText}
        isLoading={tongdokLoading}
        isCelebrating={tongdokCelebrating}
        onConfirm={(autoComplete) => {
          void handleTongdokCompleteConfirm(autoComplete)
        }}
      />

      <TongdokAlreadyCompleteModal
        isOpen={showTongdokAlreadyCompleteModal}
        onClose={() => setShowTongdokAlreadyCompleteModal(false)}
        scheduleRange={tongdokRangeText}
        isLoading={tongdokLoading}
        onAction={(action) => {
          void handleAlreadyCompleteAction(action)
        }}
      />

      <TongdokNextScheduleModal
        isOpen={showTongdokNextScheduleModal}
        onClose={() => setShowTongdokNextScheduleModal(false)}
        scheduleRange={tongdokRangeText}
        nextScheduleText={nextTongdokSchedule
          ? formatNextScheduleText(nextTongdokSchedule.book, nextTongdokSchedule.chapter, nextTongdokSchedule.date)
          : undefined}
        onAction={(action) => {
          handleNextScheduleAction(action)
        }}
      />
    </>
  )
}
