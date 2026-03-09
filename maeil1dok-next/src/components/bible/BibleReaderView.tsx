'use client'

import { useEffect, useMemo, useRef } from 'react'
import BibleChapterView from './BibleChapterView'
import { VerseActionMenu } from './VerseActionMenu'
import { useVerseSelection } from './VerseSelector'
import { BIBLE_BOOKS, type BibleVersion } from '@/lib/bible/books'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import { useBibleContent } from '@/hooks/bible/useBibleContent'
import { useBookmark } from '@/hooks/bible/useBookmark'
import { useHighlight } from '@/hooks/bible/useHighlight'
import { useNote } from '@/hooks/bible/useNote'
import { usePersonalRecord } from '@/hooks/bible/usePersonalRecord'
import { useReadingSettings } from '@/hooks/bible/useReadingSettings'
import type { UserReadingSettings } from '@/types/profile'
import BibleReaderHeader from './reader/BibleReaderHeader'
import TongdokProgressBar from './reader/TongdokProgressBar'
import BibleBottomNav from './reader/BibleBottomNav'
import ContentBottomAction from './reader/ContentBottomAction'
import { useVerseInteraction } from './reader/useVerseInteraction'
import { BOOK_ABBREVIATIONS } from './reader/bookAbbreviations'
import './BibleReaderView.css'

interface BibleReaderViewProps {
  book: string
  chapter: number
  version: BibleVersion
  userId?: string
  onPrevChapter: () => void
  onNextChapter: () => void
  onOpenBookSelector: () => void
  onOpenBookmarkModal: () => void
  onOpenSettingsModal: () => void
  onMarkAsRead: () => void
  tongdokMode: boolean
  tongdokRangeText: string
  tongdokProgress: { completed: number; total: number }
  onDisableTongdokMode: () => void
  audioLink: string | null
  guideLink: string | null
  onAudioLinkClick: (url: string) => void
}

export default function BibleReaderView({
  book,
  chapter,
  version,
  userId,
  onPrevChapter,
  onNextChapter,
  onOpenBookSelector,
  onOpenBookmarkModal,
  onOpenSettingsModal,
  onMarkAsRead,
  tongdokMode,
  tongdokRangeText,
  tongdokProgress,
  onDisableTongdokMode,
  audioLink,
  guideLink,
  onAudioLinkClick,
}: BibleReaderViewProps) {
  const { settings } = useReadingSettings()
  const { content, isLoading, error } = useBibleContent(book, chapter, version, settings)
  const {
    highlights,
    createHighlight,
    deleteHighlight,
    getVerseHighlight,
  } = useHighlight(book, chapter, version)
  const { isBookmarked, toggleBookmark } = useBookmark(book, chapter)
  const { noteCount } = useNote(book, chapter)
  const { selectedVerseRange, onVerseClick, clearSelection } = useVerseSelection()
  const { isChapterRead, getBookProgress } = usePersonalRecord(book)

  const bookName = BIBLE_BOOKS[book]?.ko ?? book
  const shortBookName = BOOK_ABBREVIATIONS[bookName] ?? bookName.charAt(0)
  const maxChapter = BIBLE_BOOKS[book]?.chapters ?? 1
  const hasPrevChapter = chapter > 1
  const hasNextChapter = chapter < maxChapter
  const currentChapterRead = isChapterRead(chapter)
  const bookProgress = getBookProgress()

  const chapterText = useMemo(() => {
    const source = content ?? ''
    return source
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }, [content])

  const currentHighlight = useMemo(() => {
    if (!selectedVerseRange) {
      return null
    }

    return getVerseHighlight(selectedVerseRange.start)
  }, [getVerseHighlight, selectedVerseRange])

  const mappedReadingSettings = useMemo<UserReadingSettings>(() => ({
    id: 'reader-settings',
    userId: 'reader-user',
    theme: settings.theme,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    fontWeight: settings.fontWeight,
    lineHeight: settings.lineHeight,
    textAlign: settings.textAlign,
    verseJoining: settings.verseJoining,
    showVerseNumbers: settings.showVerseNumbers,
    showDescription: settings.showDescription,
    showCrossRef: settings.showCrossRef,
    highlightNames: settings.highlightNames,
    showFootnotes: settings.showFootnotes,
    tongdokAutoComplete: settings.tongdokAutoComplete,
    createdAt: '',
    updatedAt: '',
  }), [settings])

  const {
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
  } = useVerseInteraction({
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
  })

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeNavigation({
    onSwipeLeft: onNextChapter,
    onSwipeRight: onPrevChapter,
  })

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    const key = `scroll-${book}-${chapter}`
    const savedPosition = localStorage.getItem(key)

    if (savedPosition !== null) {
      const parsedPosition = Number(savedPosition)
      const nextPosition = Number.isFinite(parsedPosition) ? parsedPosition : 0

      requestAnimationFrame(() => {
        container.scrollTop = nextPosition
      })
    } else {
      container.scrollTop = 0
    }

    return () => {
      localStorage.setItem(key, String(container.scrollTop))
    }
  }, [book, chapter])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    const key = `scroll-${book}-${chapter}`

    const handleScroll = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = setTimeout(() => {
        localStorage.setItem(key, String(container.scrollTop))
      }, 1500)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [book, chapter])
  /* --- Render --- */
  return (
    <div
      className="flex flex-1 flex-col min-h-0"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <BibleReaderHeader
        bookName={bookName}
        shortBookName={shortBookName}
        chapter={chapter}
        tongdokMode={tongdokMode}
        isBookmarked={isBookmarked}
        noteCount={noteCount}
        audioLink={audioLink}
        guideLink={guideLink}
        onOpenBookSelector={onOpenBookSelector}
        onDisableTongdokMode={onDisableTongdokMode}
        onToggleBookmark={() => void toggleBookmark()}
        onOpenBookmarkModal={onOpenBookmarkModal}
        onOpenSettingsModal={onOpenSettingsModal}
        onAudioLinkClick={onAudioLinkClick}
      />

      {tongdokMode && tongdokProgress.total > 0 ? (
        <TongdokProgressBar tongdokProgress={tongdokProgress} />
      ) : null}

      <div ref={scrollContainerRef} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        <BibleChapterView
          book={book}
          chapter={chapter}
          version={version}
          content={content ?? `<p>${error ?? ''}</p>`}
          isLoading={isLoading}
          onVerseTap={handleVerseTap}
          highlights={highlights}
          readingSettings={mappedReadingSettings}
        />

        {!isLoading ? (
          <ContentBottomAction
            tongdokMode={tongdokMode}
            tongdokRangeText={tongdokRangeText}
            tongdokProgress={tongdokProgress}
            currentChapterRead={currentChapterRead}
            bookName={bookName}
            bookProgress={bookProgress}
            onMarkAsRead={onMarkAsRead}
          />
        ) : null}

        <div className="h-24" />
      </div>

      <BibleBottomNav
        bookName={bookName}
        chapter={chapter}
        hasPrevChapter={hasPrevChapter}
        hasNextChapter={hasNextChapter}
        userId={userId}
        onPrevChapter={onPrevChapter}
        onNextChapter={onNextChapter}
        onOpenBookSelector={onOpenBookSelector}
      />

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
            isHighlighted={Boolean(currentHighlight)}
            onCopyTypeSelect={handleCopyByType}
            onHighlight={selectedVerseRange ? () => void handleHighlightSelect('yellow') : undefined}
            onRemoveHighlight={currentHighlight ? () => void handleRemoveHighlight() : undefined}
            onCopy={() => void navigator.clipboard.writeText(selectedText || chapterText).catch(() => undefined)}
            onShare={() => void handleShare()}
            onClose={closeMenu}
          />
        </>
      ) : null}
    </div>
  )
}
