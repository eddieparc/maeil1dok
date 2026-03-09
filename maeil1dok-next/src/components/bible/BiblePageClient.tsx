'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useBiblePageState } from '@/stores/bible/biblePageState'
import { usePersonalRecord } from '@/hooks/bible/usePersonalRecord'

import BibleHome from './BibleHome'
import BibleTOC from './BibleTOC'
import BibleReaderView from './BibleReaderView'
import Container from '@/components/ui/Container'

interface BiblePageClientProps {
  initialBook?: string
  initialChapter?: number
  initialVersion?: string
  userId?: string
}

function loadLastPosition(): { book: string; chapter: number } | null {
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

export default function BiblePageClient({ initialBook, initialChapter, initialVersion, userId }: BiblePageClientProps) {
  const router = useRouter()
  const viewMode = useBiblePageState((state) => state.viewMode)
  const currentBook = useBiblePageState((state) => state.currentBook)
  const currentChapter = useBiblePageState((state) => state.currentChapter)
  const currentVersion = useBiblePageState((state) => state.currentVersion)
  const selectBook = useBiblePageState((state) => state.selectBook)
  const selectChapter = useBiblePageState((state) => state.selectChapter)
  const setViewMode = useBiblePageState((state) => state.setViewMode)
  const initFromQuery = useBiblePageState((state) => state.initFromQuery)
  const goToPrevChapter = useBiblePageState((state) => state.goToPrevChapter)
  const goToNextChapter = useBiblePageState((state) => state.goToNextChapter)

  const { markAsRead } = usePersonalRecord(currentBook)
  const [lastPosition, setLastPosition] = useState<{ book: string; chapter: number } | null>(null)
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
      initFromQuery(params)
      setViewMode('reader')
    }
  }, [initialBook, initialChapter, initialVersion, initFromQuery, setViewMode])

  useEffect(() => {
    if (!initialized.current || viewMode !== 'reader' || typeof window === 'undefined') {
      return
    }
    const params = new URLSearchParams()
    params.set('book', currentBook)
    params.set('chapter', String(currentChapter))
    params.set('version', currentVersion)
    const nextUrl = `/bible?${params.toString()}`
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl !== nextUrl) {
      router.replace(nextUrl, { scroll: false })
    }
  }, [currentBook, currentChapter, currentVersion, viewMode, router])

  const handleSelectBookChapter = useCallback((book: string, chapter: number) => {
    selectBook(book)
    selectChapter(chapter)
    setViewMode('reader')
  }, [selectBook, selectChapter, setViewMode])

  const handleMarkAsRead = useCallback(async () => {
    await markAsRead(currentChapter)
    goToNextChapter()
  }, [markAsRead, currentChapter, goToNextChapter])

  const handleTOCSelectBook = useCallback((book: string) => {
    selectBook(book)
    selectChapter(1)
    setViewMode('reader')
  }, [selectBook, selectChapter, setViewMode])

  return (
    <Container fullHeight className="max-w-2xl pb-24">
      {viewMode === 'home' ? (
        <BibleHome
          lastPosition={lastPosition ?? undefined}
          onContinueReading={handleSelectBookChapter}
          onSelectBook={handleSelectBookChapter}
          onViewTOC={() => setViewMode('toc')}
        />
      ) : null}

      {viewMode === 'toc' ? (
        <BibleTOC
          currentBook={currentBook}
          onSelectBook={handleTOCSelectBook}
          onBack={() => setViewMode('home')}
        />
      ) : null}

      {viewMode === 'reader' ? (
        <BibleReaderView
          book={currentBook}
          chapter={currentChapter}
          version={currentVersion}
          userId={userId}
          onPrevChapter={goToPrevChapter}
          onNextChapter={goToNextChapter}
          onOpenBookSelector={() => setViewMode('toc')}
          onOpenBookmarkModal={() => {
            // TODO: 통합 모달 시스템으로 북마크 모달 연결
          }}
          onOpenSettingsModal={() => {
            // TODO: 통합 모달 시스템으로 설정 모달 연결
          }}
          onMarkAsRead={() => void handleMarkAsRead()}
          tongdokMode={false}
          tongdokRangeText=""
          tongdokProgress={{ completed: 0, total: 0 }}
          onDisableTongdokMode={() => {
            // TODO: 통독 모드 비활성화 액션 연결
          }}
          audioLink={null}
          guideLink={null}
          onAudioLinkClick={(url) => {
            window.open(url, '_blank', 'noopener,noreferrer')
          }}
        />
      ) : null}
    </Container>
  )
}
