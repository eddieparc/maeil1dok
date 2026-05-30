'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'

import { useBiblePageState } from '@/stores/bible/biblePageState'
import { useTongdokMode, tongdokModeSelectors, type TongdokRange } from '@/stores/bible/tongdokMode'
import { usePersonalRecord } from '@/hooks/bible/usePersonalRecord'
import { BIBLE_BOOKS, type BibleVersion } from '@/lib/bible/books'

import BibleReaderView from './BibleReaderView'
import BookSelector from './BookSelector'
import ReadingSettingsModal from './ReadingSettingsModal'
import Container from '@/components/ui/Container'

interface BiblePageClientProps {
  initialBook?: string
  initialChapter?: number
  initialVersion?: string
  initialTongdok?: string
  initialSchedule?: string
  initialPlan?: string
  userId?: string
}

function formatTongdokRangeText(range: TongdokRange | null): string {
  if (!range) return ''
  const startName = BIBLE_BOOKS[range.startBook]?.ko ?? range.startBook
  const endName = BIBLE_BOOKS[range.endBook]?.ko ?? range.endBook
  const unit = range.startBook === 'psa' ? '편' : '장'
  const endUnit = range.endBook === 'psa' ? '편' : '장'
  if (range.startBook === range.endBook) {
    return `${startName} ${range.startChapter}-${range.endChapter}${unit}`
  }
  return `${startName} ${range.startChapter}${unit} ~ ${endName} ${range.endChapter}${endUnit}`
}

export default function BiblePageClient({
  initialBook,
  initialChapter,
  initialVersion,
  initialTongdok,
  initialSchedule,
  initialPlan,
  userId,
}: BiblePageClientProps) {
  const router = useRouter()
  const viewMode = useBiblePageState((state) => state.viewMode)
  const currentBook = useBiblePageState((state) => state.currentBook)
  const currentChapter = useBiblePageState((state) => state.currentChapter)
  const currentVersion = useBiblePageState((state) => state.currentVersion)
  const selectBook = useBiblePageState((state) => state.selectBook)
  const selectChapter = useBiblePageState((state) => state.selectChapter)
  const selectVersion = useBiblePageState((state) => state.selectVersion)
  const setViewMode = useBiblePageState((state) => state.setViewMode)
  const initFromQuery = useBiblePageState((state) => state.initFromQuery)
  const pendingTongdokParams = useBiblePageState((state) => state.pendingTongdokParams)
  const goToPrevChapter = useBiblePageState((state) => state.goToPrevChapter)
  const goToNextChapter = useBiblePageState((state) => state.goToNextChapter)

  const tongdokMode = useTongdokMode((state) => state.tongdokMode)
  const enableTongdokMode = useTongdokMode((state) => state.enableTongdokMode)
  const loadReadingDetail = useTongdokMode((state) => state.loadReadingDetail)
  const disableTongdokMode = useTongdokMode((state) => state.disableTongdokMode)
  // FIX BUG-B: selector 내부에서 action 호출 시 매 렌더링마다 새 객체 반환 → infinite loop.
  // primitive state 분리 + useMemo / useShallow 로 메모이제이션.
  const tongdokProgress = useTongdokMode(
    useShallow((state) => tongdokModeSelectors.progress(state)),
  )
  const tongdokScheduleRange = useTongdokMode(
    useShallow((state) => tongdokModeSelectors.scheduleRange(state)),
  )

  const { markAsRead } = usePersonalRecord(currentBook)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isBookSelectorOpen, setIsBookSelectorOpen] = useState(false)
  const initialized = useRef(false)
  const tongdokRangeText = useMemo(
    () => formatTongdokRangeText(tongdokScheduleRange),
    [tongdokScheduleRange],
  )

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    void pendingTongdokParams

    const hasParams = !!(
      initialBook ??
      initialChapter ??
      initialVersion ??
      initialTongdok ??
      initialSchedule ??
      initialPlan
    )

    if (hasParams) {
      const params: Record<string, string> = {}
      if (initialBook) params.book = initialBook
      if (initialChapter) params.chapter = String(initialChapter)
      if (initialVersion) params.version = initialVersion
      if (initialTongdok) params.tongdok = initialTongdok
      if (initialSchedule) params.schedule = initialSchedule
      if (initialPlan) params.plan = initialPlan
      initFromQuery(params)
      setViewMode('reader')

      if (initialTongdok === 'true' && initialSchedule) {
        const planIdStr = initialPlan ?? ''
        enableTongdokMode(initialSchedule, planIdStr)
        if (planIdStr) void loadReadingDetail(planIdStr)
      }

      router.replace('/bible', { scroll: false })
    }
  }, [
    initialBook,
    initialChapter,
    initialVersion,
    initialTongdok,
    initialSchedule,
    initialPlan,
    initFromQuery,
    setViewMode,
    enableTongdokMode,
    loadReadingDetail,
    pendingTongdokParams,
    router,
  ])

  const handleBookSelectorSelect = useCallback((book: string, chapter: number) => {
    selectBook(book)
    selectChapter(chapter)
    setViewMode('reader')
  }, [selectBook, selectChapter, setViewMode])

  const handleVersionSelect = useCallback((version: BibleVersion) => {
    selectVersion(version)
  }, [selectVersion])

  const handleMarkAsRead = useCallback(async () => {
    await markAsRead(currentChapter)
    goToNextChapter()
  }, [markAsRead, currentChapter, goToNextChapter])

  const openBookSelector = useCallback(() => {
    setIsBookSelectorOpen(true)
  }, [])

  if (viewMode === 'reader') {
    return (
      <div className="flex flex-col mx-auto max-w-3xl" style={{ minHeight: '100dvh' }}>
        <BibleReaderView
          book={currentBook}
          chapter={currentChapter}
          version={currentVersion}
          userId={userId}
          onPrevChapter={goToPrevChapter}
          onNextChapter={goToNextChapter}
          onOpenBookSelector={openBookSelector}
          onOpenBookmarkModal={() => {}}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
          onMarkAsRead={() => void handleMarkAsRead()}
          tongdokMode={tongdokMode}
          tongdokRangeText={tongdokRangeText}
          tongdokProgress={tongdokProgress}
          onDisableTongdokMode={disableTongdokMode}
          audioLink={null}
          guideLink={null}
          onAudioLinkClick={(url) => {
            window.open(url, '_blank', 'noopener,noreferrer')
          }}
        />
        <ReadingSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <BookSelector
          isOpen={isBookSelectorOpen}
          onClose={() => setIsBookSelectorOpen(false)}
          onSelect={handleBookSelectorSelect}
          onVersionSelect={handleVersionSelect}
          currentBook={currentBook}
          currentChapter={currentChapter}
          currentVersion={currentVersion}
        />
      </div>
    )
  }

  return (
    <Container fullHeight className="max-w-2xl pb-24">
      <BookSelector
        isOpen={isBookSelectorOpen}
        onClose={() => setIsBookSelectorOpen(false)}
        onSelect={handleBookSelectorSelect}
        onVersionSelect={handleVersionSelect}
        currentBook={currentBook}
        currentChapter={currentChapter}
        currentVersion={currentVersion}
      />
    </Container>
  )
}
