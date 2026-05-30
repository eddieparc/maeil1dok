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

type CopyType = 'includeLocation' | 'numOnly' | 'textOnly' | 'includeLocationRange' | 'excludeLocationRange'
type MenuMode = 'copy' | 'action'

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
  const [menuMode, setMenuMode] = useState<MenuMode>('copy')
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | undefined>(undefined)
  const [selectedText, setSelectedText] = useState('')
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([])
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
    setSelectedVerseNumbers([])
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

  const resolvedPathname = pathname ?? '/bible'
  const resolvedSearchParams = searchParams ?? new URLSearchParams()

  useReadingPosition({
    book: currentBook,
    chapter: currentChapter,
    verse: selectedVerseRange?.start ?? null,
    version: currentVersion,
    pathname: resolvedPathname,
    searchParams: resolvedSearchParams,
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
    const params = new URLSearchParams(resolvedSearchParams.toString())
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
    router.push(`${resolvedPathname}?${params.toString()}`)
  }, [currentBook, currentChapter, currentVersion, resolvedPathname, resolvedSearchParams, router])

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

  const handleVerseTap = (payload: {
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
  }

  const handleCopyByType = async (copyType: CopyType) => {
    const bookLabel = BIBLE_BOOKS[currentBook]?.ko ?? currentBook
    const numbers = selectedVerseNumbers.length > 0 ? selectedVerseNumbers : (selectedVerseRange ? [selectedVerseRange.start] : [])
    const start = numbers[0]
    const end = numbers[numbers.length - 1]
    let textToCopy = selectedText.trim()

    if (!start) {
      textToCopy = chapterText
    } else if (copyType === 'includeLocation') {
      textToCopy = `[${bookLabel}${currentChapter}:${start}] ${selectedText}`
    } else if (copyType === 'numOnly') {
      textToCopy = `${start} ${selectedText}`
    } else if (copyType === 'includeLocationRange' && end) {
      textToCopy = `[${bookLabel}${currentChapter}:${start}-${end}]\n${selectedText}`
    } else if (copyType === 'excludeLocationRange') {
      textToCopy = selectedText
    }

    await navigator.clipboard.writeText(textToCopy).catch(() => undefined)
    closeMenu()
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
    <div className="space-y-3 pb-28" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <header className="sticky top-0 z-20 -mx-4 flex h-14 items-center justify-between border-b border-[var(--color-rule)] bg-[var(--color-paper-warm)]/95 px-4 backdrop-blur-md sm:-mx-6">
        <button
          type="button"
          className="inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-1 text-left text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brand-faint)]"
          onClick={() => handleChapterChange(currentChapter)}
          aria-label="성경 책과 장"
        >
          <span
            className="truncate -tracking-[0.025em]"
            style={{
              fontFamily: 'var(--font-family-serif)',
              fontSize: 'clamp(1.0625rem, 4.5vw, 1.25rem)',
              fontWeight: 500,
            }}
          >
            {BIBLE_BOOKS[currentBook]?.ko ?? currentBook} {currentChapter}장
          </span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--color-mute)]">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <div className="flex items-center gap-1">
          <VersionSelector version={currentVersion} onVersionChange={handleVersionChange} />
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-mute)] transition-colors hover:bg-[var(--color-brand-faint)] hover:text-[var(--color-ink)]"
            aria-label="북마크"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </svg>
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-mute)] transition-colors hover:bg-[var(--color-brand-faint)] hover:text-[var(--color-ink)]"
            onClick={openMenuWithChapter}
            aria-label="본문 작업"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-mute)] transition-colors hover:bg-[var(--color-brand-faint)] hover:text-[var(--color-ink)]"
            onClick={() => setIsPanelOpen(true)}
            aria-label="설정"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

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

      <ChapterNavigation
        book={currentBook}
        chapter={currentChapter}
        bookKeys={bookKeys}
        onBookChange={handleBookChange}
        onChapterChange={handleChapterChange}
        onPrevChapter={handlePrevChapter}
        onNextChapter={handleNextChapter}
      />

      {readingSettings ? (
        <ReadingSettingsPanel
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          settings={readingSettings}
          onSettingChange={handleReadingSettingChange}
        />
      ) : null}

      {selectedVerseRange ? (
        <div
          className="pointer-events-none fixed bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-1 text-[11px] font-semibold text-[var(--color-brand)] shadow-[var(--shadow-card)] -tracking-[0.005em]"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {selectedVerseRange.start === selectedVerseRange.end
            ? `${selectedVerseRange.start}절 선택`
            : `${selectedVerseRange.start}-${selectedVerseRange.end}절 선택`}
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
            mode={menuMode}
            position={menuPosition}
            isRange={selectedVerseNumbers.length > 1}
            isHighlighted={Boolean(selectedHighlight)}
            onCopyTypeSelect={handleCopyByType}
            onHighlight={selectedVerseRange ? () => void handleHighlightSelect('yellow') : undefined}
            onRemoveHighlight={selectedHighlight ? () => void handleRemoveHighlight() : undefined}
            onCopy={() => void navigator.clipboard.writeText(selectedText || chapterText).catch(() => undefined)}
            onShare={() => void navigator.clipboard.writeText(selectedText || chapterText).catch(() => undefined)}
            onClose={closeMenu}
          />
        </>
      ) : null}
    </div>
  )
}
