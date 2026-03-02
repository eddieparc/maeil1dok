'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import BibleChapterView from './BibleChapterView'
import ChapterNavigation from './ChapterNavigation'
import { VerseActionMenu } from './VerseActionMenu'
import { useVerseSelection } from './VerseSelector'
import { BIBLE_BOOKS, BIBLE_BOOK_KEYS, type BibleVersion } from '@/lib/bible/books'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import { useBibleContent } from '@/hooks/bible/useBibleContent'
import { useBookmark } from '@/hooks/bible/useBookmark'
import { useHighlight } from '@/hooks/bible/useHighlight'
import { useNote } from '@/hooks/bible/useNote'
import { useReadingSettings } from '@/hooks/bible/useReadingSettings'
import { useTongdokMode } from '@/hooks/bible/useTongdokMode'
import type { HighlightColor } from '@/types'
import type { UserReadingSettings } from '@/types/profile'

interface BibleReaderViewProps {
  book: string
  chapter: number
  version: BibleVersion
  onPrevChapter: () => void
  onNextChapter: () => void
  onOpenBookSelector: () => void
  onOpenNoteModal: () => void
  onOpenHighlightModal: () => void
  onOpenSettingsModal: () => void
  onMarkAsRead: () => void
}

function inferVerseNumber(text: string) {
  const match = text.match(/^\s*(\d{1,3})\b/)
  return match ? Number(match[1]) : null
}

function formatTongdokRange(book: string, chapter: number, range: ReturnType<ReturnType<typeof useTongdokMode>['getTongdokScheduleRange']>) {
  if (!range) {
    return `${BIBLE_BOOKS[book]?.ko ?? book} ${chapter}장`
  }

  const startBook = BIBLE_BOOKS[range.startBook]?.ko ?? range.startBook
  const endBook = BIBLE_BOOKS[range.endBook]?.ko ?? range.endBook
  return `${startBook} ${range.startChapter}장 - ${endBook} ${range.endChapter}장`
}

export default function BibleReaderView({
  book,
  chapter,
  version,
  onPrevChapter,
  onNextChapter,
  onOpenBookSelector,
  onOpenNoteModal,
  onOpenHighlightModal,
  onOpenSettingsModal,
  onMarkAsRead,
}: BibleReaderViewProps) {
  const { settings } = useReadingSettings()
  const { content, isLoading, error, chapterTitle } = useBibleContent(book, chapter, version, settings)
  const {
    highlights,
    createHighlight,
    deleteHighlight,
    getVerseHighlight,
    customColors,
  } = useHighlight(book, chapter, version)
  const { isBookmarked, toggleBookmark } = useBookmark(book, chapter)
  const { noteCount } = useNote(book, chapter)
  const { selectedVerseRange, onVerseClick, clearSelection } = useVerseSelection()
  const {
    tongdokMode,
    tongdokPlanId,
    loadReadingDetail,
    getTongdokScheduleRange,
    getTongdokProgress,
  } = useTongdokMode()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | undefined>(undefined)
  const [selectedText, setSelectedText] = useState('')

  useEffect(() => {
    if (!tongdokMode || !tongdokPlanId) {
      return
    }

    void loadReadingDetail(tongdokPlanId)
  }, [loadReadingDetail, tongdokMode, tongdokPlanId])

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

  const tongdokRange = getTongdokScheduleRange()
  const tongdokProgress = getTongdokProgress()

  const handleVerseTap = useCallback((payload: { text: string; position?: { x: number; y: number } }) => {
    const verseNumber = inferVerseNumber(payload.text)
    if (verseNumber !== null) {
      onVerseClick(verseNumber)
    } else {
      clearSelection()
    }

    setSelectedText(payload.text || chapterText)
    setMenuPosition(payload.position)
    setIsMenuOpen(true)
  }, [chapterText, clearSelection, onVerseClick])

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
    const title = `${BIBLE_BOOKS[book]?.ko ?? book} ${chapter}장`
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined)
      return
    }

    await navigator.clipboard.writeText(url).catch(() => undefined)
  }, [book, chapter, version])

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeNavigation({
    onSwipeLeft: onNextChapter,
    onSwipeRight: onPrevChapter,
  })

  return (
    <div className="space-y-4" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            className="text-left"
            onClick={onOpenBookSelector}
            aria-label="책과 장 선택"
          >
            <h1 className="text-xl font-semibold text-gray-900">
              {BIBLE_BOOKS[book]?.ko ?? book} {chapter}장
            </h1>
            {chapterTitle ? <p className="text-sm text-gray-500">{chapterTitle}</p> : null}
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={onOpenSettingsModal}
          >
            설정
          </button>
        </div>

        {tongdokMode ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <p className="font-semibold">통독 모드</p>
            <p className="mt-1">범위: {formatTongdokRange(book, chapter, tongdokRange)}</p>
            <p className="mt-1">진행: {tongdokProgress.completed}/{tongdokProgress.total}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-md border border-emerald-300 px-2 py-1"
              >
                오디오
              </button>
              <button
                type="button"
                className="rounded-md border border-emerald-300 px-2 py-1"
              >
                가이드
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <ChapterNavigation
        book={book}
        chapter={chapter}
        bookKeys={BIBLE_BOOK_KEYS}
        onBookChange={onOpenBookSelector}
        onChapterChange={onOpenBookSelector}
        onPrevChapter={onPrevChapter}
        onNextChapter={onNextChapter}
      />

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

      <section className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => void toggleBookmark()}
          >
            {isBookmarked ? '북마크 해제' : '북마크'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            onClick={onOpenNoteModal}
          >
            노트 ({noteCount})
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            onClick={onOpenHighlightModal}
          >
            하이라이트
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => void handleShare()}
          >
            공유
          </button>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            onClick={onMarkAsRead}
          >
            읽음으로 표시
          </button>
        </div>

        {selectedVerseRange ? (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <span>선택 구절: {selectedVerseRange.start}절</span>
            <button
              type="button"
              className="rounded border border-blue-200 px-2 py-1"
              onClick={() => setIsMenuOpen(true)}
            >
              액션 열기
            </button>
          </div>
        ) : null}

        {customColors.length > 0 ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <span>최근 색상</span>
            {customColors.map((color) => (
              <button
                key={color}
                type="button"
                className="h-4 w-4 rounded-full border border-gray-300"
                style={{ backgroundColor: color }}
                aria-label={`최근 색상 ${color}`}
                onClick={() => void handleHighlightSelect(color as HighlightColor)}
              />
            ))}
          </div>
        ) : null}
      </section>

      {isMenuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/0"
            aria-label="본문 작업 메뉴 닫기"
            onClick={() => setIsMenuOpen(false)}
          />
          <VerseActionMenu
            book={book}
            chapter={chapter}
            version={version}
            verseText={selectedText || chapterText}
            position={menuPosition}
            isHighlighted={Boolean(currentHighlight)}
            onHighlightSelect={selectedVerseRange ? handleHighlightSelect : undefined}
            onRemoveHighlight={currentHighlight ? handleRemoveHighlight : undefined}
            onClose={() => setIsMenuOpen(false)}
          />
        </>
      ) : null}
    </div>
  )
}
