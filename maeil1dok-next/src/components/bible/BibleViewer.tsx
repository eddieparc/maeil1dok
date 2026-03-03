'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import BibleChapterView from './BibleChapterView'
import ChapterNavigation from './ChapterNavigation'
import ReadingSettingsPanel from './ReadingSettingsPanel'
import { VerseActionMenu } from './VerseActionMenu'
import { useVerseSelection } from './VerseSelector'
import VersionSelector from './VersionSelector'
import { useReadingPosition } from '@/hooks/useReadingPosition'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import { BIBLE_BOOKS, isBibleVersion, type BibleVersion } from '@/lib/bible/books'
import type { HighlightColor, VerseHighlight } from '@/types'
import type { UserReadingPosition, UserReadingSettings } from '@/types/profile'

interface BibleViewerProps {
  initialBook: string
  initialChapter: number
  initialVersion: BibleVersion
  bookKeys: string[]
}

function getProxyPrefix(version: BibleVersion): 'KNT' | 'bible' {
  return version === 'KNT' ? 'KNT' : 'bible'
}

function stripHtmlTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferVerseNumber(text: string) {
  const match = text.match(/^\s*(\d{1,3})\b/)
  return match ? Number(match[1]) : null
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA <= endB && startB <= endA
}

export default function BibleViewer({
  initialBook,
  initialChapter,
  initialVersion,
  bookKeys,
}: BibleViewerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [currentBook, setCurrentBook] = useState(initialBook)
  const [currentChapter, setCurrentChapter] = useState(initialChapter)
  const [currentVersion, setCurrentVersion] = useState<BibleVersion>(initialVersion)
  const [content, setContent] = useState('')
  const [contentError, setContentError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | undefined>(undefined)
  const [selectedText, setSelectedText] = useState('')
  const [highlights, setHighlights] = useState<VerseHighlight[]>([])
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [readingSettings, setReadingSettings] = useState<UserReadingSettings | null>(null)
  const { selectedVerseRange, onVerseClick, clearSelection } = useVerseSelection()

  const maxChapter = useMemo(() => {
    return BIBLE_BOOKS[currentBook]?.chapters ?? 1
  }, [currentBook])

  const chapterText = useMemo(() => stripHtmlTags(content), [content])

  const resetSelectionAndMenu = useCallback(() => {
    clearSelection()
    setSelectedText('')
    setMenuPosition(undefined)
    setIsMenuOpen(false)
  }, [clearSelection])

  const handleRestorePosition = useCallback((position: UserReadingPosition) => {
    const restoredBook = position.book in BIBLE_BOOKS ? position.book : initialBook
    const restoredMaxChapter = BIBLE_BOOKS[restoredBook]?.chapters ?? 1
    const restoredChapter = Math.min(Math.max(position.chapter, 1), restoredMaxChapter)
    const restoredVersion = isBibleVersion(position.version) ? position.version : initialVersion

    resetSelectionAndMenu()
    setCurrentBook(restoredBook)
    setCurrentChapter(restoredChapter)
    setCurrentVersion(restoredVersion)

    if (position.verse !== null) {
      onVerseClick(position.verse)
    }
  }, [initialBook, initialVersion, onVerseClick, resetSelectionAndMenu])

  useReadingPosition({
    book: currentBook,
    chapter: currentChapter,
    verse: selectedVerseRange?.start ?? null,
    version: currentVersion,
    pathname,
    searchParams,
    router,
    onRestore: handleRestorePosition,
  })

  useEffect(() => {
    const controller = new AbortController()

    async function fetchReadingSettings() {
      try {
        const response = await fetch('/api/profile/reading-settings', { signal: controller.signal })
        if (!response.ok) {
          return
        }

        const settings = (await response.json()) as UserReadingSettings
        setReadingSettings(settings)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setReadingSettings(null)
        }
      }
    }

    fetchReadingSettings()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!readingSettings?.id) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      fetch('/api/profile/reading-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(readingSettings),
      }).catch(() => undefined)
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [readingSettings])

  const handleReadingSettingChange = useCallback((key: keyof UserReadingSettings, value: unknown) => {
    setReadingSettings((prev) => {
      if (!prev) {
        return prev
      }

      return {
        ...prev,
        [key]: value,
      }
    })
  }, [])

  useEffect(() => {
    if (currentChapter > maxChapter) {
      setCurrentChapter(maxChapter)
    }
  }, [currentChapter, maxChapter])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const nextBook = params.get('book')
    const nextChapter = params.get('chapter')
    const nextVersion = params.get('version')

    if (
      nextBook === currentBook
      && nextChapter === String(currentChapter)
      && nextVersion === currentVersion
    ) {
      return
    }

    params.set('book', currentBook)
    params.set('chapter', String(currentChapter))
    params.set('version', currentVersion)
    router.push(`${pathname}?${params.toString()}`)
  }, [currentBook, currentChapter, currentVersion, pathname, router, searchParams])

  const fetchChapterContent = useCallback(async (signal?: AbortSignal) => {
    const prefix = getProxyPrefix(currentVersion)
    const url = `/api/bible-proxy/${prefix}/korbibReadpage.php?version=${currentVersion}&book=${currentBook}&chap=${currentChapter}`

    try {
      setIsLoading(true)
      setContentError(null)

      const response = await fetch(url, signal ? { signal } : undefined)
      if (!response.ok) {
        throw new Error(`성경 본문 요청 실패 (${response.status})`)
      }

      const html = await response.text()
      setContent(html)
      setContentError(null)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setContent('')
        setContentError('네트워크 상태를 확인한 뒤 다시 시도해 주세요.')
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [currentBook, currentChapter, currentVersion])

  useEffect(() => {
    const controller = new AbortController()
    void fetchChapterContent(controller.signal)

    return () => controller.abort()
  }, [fetchChapterContent])

  const loadHighlights = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams({
        book: currentBook,
        chapter: String(currentChapter),
        version: currentVersion,
      })

      const response = await fetch(`/api/bible/highlights?${params.toString()}`, { signal })
      if (!response.ok) {
        setHighlights([])
        return
      }

      const data = (await response.json()) as VerseHighlight[]
      setHighlights(data)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setHighlights([])
      }
    }
  }, [currentBook, currentChapter, currentVersion])

  const handleHighlightsLoaded = useCallback((nextHighlights: VerseHighlight[]) => {
    setHighlights(nextHighlights)
  }, [])

  const handleBookChange = (nextBook: string) => {
    resetSelectionAndMenu()
    setCurrentBook(nextBook)
    setCurrentChapter(1)
  }

  const handleChapterChange = (nextChapter: number) => {
    resetSelectionAndMenu()
    setCurrentChapter(Math.min(Math.max(nextChapter, 1), maxChapter))
  }

  const handlePrevChapter = () => {
    resetSelectionAndMenu()
    setCurrentChapter((prev) => Math.max(prev - 1, 1))
  }

  const handleNextChapter = () => {
    resetSelectionAndMenu()
    setCurrentChapter((prev) => Math.min(prev + 1, maxChapter))
  }

  const handleVersionChange = (nextVersion: BibleVersion) => {
    resetSelectionAndMenu()
    setCurrentVersion(nextVersion)
  }

  const openMenuWithChapter = () => {
    setSelectedText(chapterText)
    setMenuPosition(undefined)
    setIsMenuOpen(true)
  }

  const handleVerseTap = (payload: { text: string; verseNumber?: number; position?: { x: number; y: number } }) => {
    const verseNumber = typeof payload.verseNumber === 'number' ? payload.verseNumber : inferVerseNumber(payload.text)

    if (verseNumber !== null) {
      onVerseClick(verseNumber)
    } else {
      clearSelection()
    }

    setSelectedText(payload.text || chapterText)
    setMenuPosition(payload.position)
    setIsMenuOpen(true)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
    setMenuPosition(undefined)
  }

  const handleRetryFetch = useCallback(() => {
    void fetchChapterContent()
  }, [fetchChapterContent])

  const selectedHighlight = useMemo(() => {
    if (!selectedVerseRange) {
      return null
    }

    return highlights.find((highlight) =>
      rangesOverlap(
        selectedVerseRange.start,
        selectedVerseRange.end,
        highlight.verseStart,
        highlight.verseEnd
      )
    ) ?? null
  }, [highlights, selectedVerseRange])

  const handleHighlightSelect = useCallback(async (color: HighlightColor) => {
    if (!selectedVerseRange) {
      return
    }

    const optimisticId = `optimistic-${Date.now()}`
    const optimisticHighlight: VerseHighlight = {
      id: optimisticId,
      userId: '',
      book: currentBook,
      chapter: currentChapter,
      verseStart: selectedVerseRange.start,
      verseEnd: selectedVerseRange.end,
      color,
      version: currentVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setHighlights((prev) => [
      ...prev.filter(
        (highlight) => !rangesOverlap(
          highlight.verseStart,
          highlight.verseEnd,
          selectedVerseRange.start,
          selectedVerseRange.end
        )
      ),
      optimisticHighlight,
    ])

    try {
      const response = await fetch('/api/bible/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book: currentBook,
          chapter: currentChapter,
          verseStart: selectedVerseRange.start,
          verseEnd: selectedVerseRange.end,
          color,
          version: currentVersion,
        }),
      })

      if (!response.ok) {
        await loadHighlights()
        return
      }

      const saved = (await response.json()) as VerseHighlight
      setHighlights((prev) => [
        ...prev.filter((highlight) => highlight.id !== optimisticId && highlight.id !== saved.id),
        saved,
      ])
    } catch (error) {
      await loadHighlights()
    }
  }, [currentBook, currentChapter, currentVersion, loadHighlights, selectedVerseRange])

  const handleRemoveHighlight = useCallback(async () => {
    if (!selectedHighlight) {
      return
    }

    const removedHighlight = selectedHighlight
    setHighlights((prev) => prev.filter((highlight) => highlight.id !== removedHighlight.id))

    try {
      const params = new URLSearchParams({ id: removedHighlight.id })
      const response = await fetch(`/api/bible/highlights?${params.toString()}`, { method: 'DELETE' })
      if (!response.ok) {
        setHighlights((prev) => [...prev, removedHighlight])
      }
    } catch (error) {
      setHighlights((prev) => [...prev, removedHighlight])
    }
  }, [selectedHighlight])

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeNavigation({
    onSwipeLeft: handleNextChapter,
    onSwipeRight: handlePrevChapter,
  })

  return (
    <div className="space-y-4" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <section className="rounded-2xl bg-[var(--color-bg-secondary)] p-4 shadow-sm border border-[var(--color-border-default)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            {BIBLE_BOOKS[currentBook]?.ko ?? currentBook} {currentChapter}장
          </h1>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--color-info-bg)] px-3 py-1 text-xs font-medium text-[var(--color-info-text)]">
              {currentVersion}
            </span>
            <button
              type="button"
              className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)]"
              onClick={() => setIsPanelOpen(true)}
              aria-label="읽기 설정 열기"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <title>읽기 설정</title>
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
        <VersionSelector version={currentVersion} onVersionChange={handleVersionChange} />
      </section>

      <ChapterNavigation
        book={currentBook}
        chapter={currentChapter}
        bookKeys={bookKeys}
        onBookChange={handleBookChange}
        onChapterChange={handleChapterChange}
        onPrevChapter={handlePrevChapter}
        onNextChapter={handleNextChapter}
      />

      <BibleChapterView
        book={currentBook}
        chapter={currentChapter}
        version={currentVersion}
        content={content}
        isLoading={isLoading}
        error={contentError}
        onRetry={handleRetryFetch}
        onVerseTap={handleVerseTap}
        highlights={highlights}
        onHighlightsLoaded={handleHighlightsLoaded}
        readingSettings={readingSettings}
        selectedVerseRange={selectedVerseRange}
      />

      {readingSettings ? (
        <ReadingSettingsPanel
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          settings={readingSettings}
          onSettingChange={handleReadingSettingChange}
        />
      ) : null}

      <button
        type="button"
        className="fixed bottom-24 right-4 z-30 rounded-full bg-[var(--color-primary)] p-3 text-white shadow-[var(--shadow-lg)] transition hover:opacity-90"
        onClick={openMenuWithChapter}
        aria-label="본문 작업 메뉴 열기"
      >
        📋
      </button>

      {selectedVerseRange ? (
        <div className="fixed bottom-24 left-4 z-20 rounded-full bg-[var(--color-info-bg)] px-3 py-1 text-xs font-medium text-[var(--color-info-text)] shadow-sm">
          선택 {selectedVerseRange.start}절
        </div>
      ) : null}

      {isMenuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/0"
            aria-label="본문 작업 메뉴 닫기"
            onClick={closeMenu}
          />
          <VerseActionMenu
            book={currentBook}
            chapter={currentChapter}
            version={currentVersion}
            verseText={selectedText || chapterText}
            position={menuPosition}
            isHighlighted={Boolean(selectedHighlight)}
            onHighlightSelect={selectedVerseRange ? handleHighlightSelect : undefined}
            onRemoveHighlight={selectedHighlight ? handleRemoveHighlight : undefined}
            onClose={closeMenu}
          />
        </>
      ) : null}
    </div>
  )
}
