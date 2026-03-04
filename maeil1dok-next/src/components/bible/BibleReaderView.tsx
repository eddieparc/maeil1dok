'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Headphones,
  Home,
  User,
  X,
} from 'lucide-react'
import BibleChapterView from './BibleChapterView'
import { VerseActionMenu } from './VerseActionMenu'
import { useVerseSelection } from './VerseSelector'
import { BIBLE_BOOKS, type BibleVersion } from '@/lib/bible/books'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import { useBibleContent } from '@/hooks/bible/useBibleContent'
import { useBookmark } from '@/hooks/bible/useBookmark'
import { useHighlight } from '@/hooks/bible/useHighlight'
import { useNote } from '@/hooks/bible/useNote'
import { useReadingSettings } from '@/hooks/bible/useReadingSettings'
import { usePersonalRecord } from '@/hooks/bible/usePersonalRecord'
import { cn } from '@/lib/utils'
import type { HighlightColor } from '@/types'
import type { UserReadingSettings } from '@/types/profile'
import './BibleReaderView.css'

type CopyType = 'includeLocation' | 'numOnly' | 'textOnly' | 'includeLocationRange' | 'excludeLocationRange'
type MenuMode = 'copy' | 'action'

/* ===== Book name abbreviation map ===== */
const BOOK_ABBREVIATIONS: Record<string, string> = {
  '창세기': '창', '출애굽기': '출', '레위기': '레', '민수기': '민', '신명기': '신',
  '여호수아': '수', '사사기': '삿', '룻기': '룻', '사무엘상': '삼상', '사무엘하': '삼하',
  '열왕기상': '왕상', '열왕기하': '왕하', '역대상': '대상', '역대하': '대하',
  '에스라': '스', '느헤미야': '느', '에스더': '에', '욥기': '욥', '시편': '시',
  '잠언': '잠', '전도서': '전', '아가': '아', '이사야': '사', '예레미야': '렘',
  '예레미야애가': '애', '에스겔': '겔', '다니엘': '단', '호세아': '호', '요엘': '욜',
  '아모스': '암', '오바댜': '옵', '요나': '욘', '미가': '미', '나훔': '나',
  '하박국': '합', '스바냐': '습', '학개': '학', '스가랴': '슥', '말라기': '말',
  '마태복음': '마', '마가복음': '막', '누가복음': '눅', '요한복음': '요',
  '사도행전': '행', '로마서': '롬', '고린도전서': '고전', '고린도후서': '고후',
  '갈라디아서': '갈', '에베소서': '엡', '빌립보서': '빌', '골로새서': '골',
  '데살로니가전서': '살전', '데살로니가후서': '살후', '디모데전서': '딤전', '디모데후서': '딤후',
  '디도서': '딛', '빌레몬서': '몬', '히브리서': '히', '야고보서': '약',
  '베드로전서': '벧전', '베드로후서': '벧후', '요한일서': '요일', '요한이서': '요이',
  '요한삼서': '요삼', '유다서': '유', '요한계시록': '계',
}

/* ===== Props ===== */
interface BibleReaderViewProps {
  book: string
  chapter: number
  version: BibleVersion
  onPrevChapter: () => void
  onNextChapter: () => void
  onOpenBookSelector: () => void
  onOpenHighlightModal: () => void
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

/* ===== Helpers ===== */
function inferVerseNumber(text: string) {
  const match = text.match(/^\s*(\d{1,3})\b/)
  return match ? Number(match[1]) : null
}

/* ===== Component ===== */
export default function BibleReaderView({
  book,
  chapter,
  version,
  onPrevChapter,
  onNextChapter,
  onOpenBookSelector,
  onOpenHighlightModal,
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
  /* --- Hooks --- */
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

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuMode, setMenuMode] = useState<MenuMode>('copy')
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | undefined>(undefined)
  const [selectedText, setSelectedText] = useState('')
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([])

  /* --- Effects --- */
  /* --- Derived state --- */
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

  /* --- Event handlers --- */
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

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeNavigation({
    onSwipeLeft: onNextChapter,
    onSwipeRight: onPrevChapter,
  })

  /* --- Render --- */
  return (
    <div
      className="flex flex-1 flex-col min-h-0"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* ===== Sticky Header ===== */}
      <header className="bible-reader-header">
        {/* Left: Book selector */}
        {tongdokMode ? (
          /* 통독 mode: [dot] [book chapter] [x] */
          <div className="flex flex-1 items-center gap-1 min-w-0">
            <button
              type="button"
              className="flex items-center gap-1.5 min-w-0 bg-transparent border-none cursor-pointer active:opacity-70"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              onClick={onOpenBookSelector}
            >
              <span className="tongdok-dot" />
              <span className="book-name-full text-[clamp(1.125rem,5vw,1.375rem)] font-bold text-[var(--color-success)] whitespace-nowrap overflow-hidden text-ellipsis tracking-tight">
                {bookName} {chapter}장
              </span>
              <span className="book-name-short text-[clamp(1.125rem,5vw,1.375rem)] font-bold text-[var(--color-success)] whitespace-nowrap overflow-hidden text-ellipsis tracking-tight">
                {shortBookName} {chapter}장
              </span>
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-6 h-6 text-[var(--color-text-tertiary)] rounded hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-button-default)] active:scale-90 transition-all shrink-0"
              onClick={onDisableTongdokMode}
              title="통독모드 종료"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          /* Normal mode: [book chapter] [bookmark] */
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <button
              type="button"
              className="flex items-center gap-1 min-w-0 rounded-md bg-transparent border-none px-1 py-0.5 cursor-pointer active:opacity-70"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              onClick={onOpenBookSelector}
              aria-label="성경 책과 장 선택"
            >
              <span className="book-name-full text-[clamp(1.125rem,5vw,1.375rem)] font-bold text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden text-ellipsis tracking-tight">
                {bookName} {chapter}장
              </span>
              <span className="book-name-short text-[clamp(1.125rem,5vw,1.375rem)] font-bold text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden text-ellipsis tracking-tight">
                {shortBookName} {chapter}장
              </span>
              <ChevronDown size={16} aria-hidden="true" className="text-[var(--color-text-tertiary)]" />
            </button>
          </div>
        )}

        {/* Center: Tongdok action buttons (audio/guide) */}
        {tongdokMode ? (
          <div className="flex flex-1 items-center justify-end gap-0.5">
            {audioLink ? (
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-1 text-[var(--color-text-secondary)] bg-transparent border-none rounded-md text-xs font-medium transition-all hover:bg-[var(--color-button-default)] hover:text-[var(--color-text-primary)] active:scale-95 cursor-pointer whitespace-nowrap"
                title="오디오"
                onClick={() => onAudioLinkClick(audioLink)}
              >
                <Headphones size={16} />
                <span className="tongdok-action-text">듣기</span>
              </button>
            ) : null}
            {guideLink ? (
              <a
                href={guideLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2 py-1 text-[var(--color-text-secondary)] border-none rounded-md text-xs font-medium transition-all hover:bg-[var(--color-button-default)] hover:text-[var(--color-text-primary)] active:scale-95 cursor-pointer whitespace-nowrap no-underline"
                title="가이드"
              >
                <BookOpen size={16} />
                <span className="tongdok-action-text">가이드</span>
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)]"
            onClick={onOpenHighlightModal}
            aria-label="성경 번역 선택"
          >
            <span>{version}</span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          {!tongdokMode ? (
            <button
              type="button"
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-lg transition-all active:scale-95',
                isBookmarked
                  ? 'text-[var(--color-accent-primary)] bg-[var(--color-accent-light)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-button-default)] hover:text-[var(--color-text-primary)]',
              )}
              onClick={isBookmarked ? () => void toggleBookmark() : onOpenBookmarkModal}
              aria-label={isBookmarked ? '북마크 삭제' : '북마크 추가'}
            >
              <Bookmark size={18} aria-hidden="true" fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>
          ) : null}
          <button
            type="button"
            className="tool-trigger-button"
            onClick={onOpenSettingsModal}
            aria-label="도구"
          >
            <Ellipsis size={18} aria-hidden="true" />
            {noteCount > 0 ? <span className="indicator-dot" /> : null}
          </button>
        </div>
      </header>

      {/* ===== Tongdok Progress Bar (story-style) ===== */}
      {tongdokMode && tongdokProgress.total > 0 ? (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border-default)]">
          <div className="story-progress-segments">
            {Array.from({ length: tongdokProgress.total }, (_, segment) => segment + 1).map((segment) => (
              <div
                key={`progress-${segment}`}
                className={cn(
                  'progress-segment',
                  segment <= tongdokProgress.completed && 'filled',
                  segment === tongdokProgress.completed + 1 && 'current',
                )}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap min-w-[2rem] text-right tabular-nums">
            {tongdokProgress.completed}/{tongdokProgress.total}
          </span>
        </div>
      ) : null}

      {/* ===== Bible Content ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto">
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

        {/* Bottom action area (inline below content) */}
        {!isLoading ? (
          <div className="content-bottom-action">
            {/* Mark as read / tongdok complete */}
            {tongdokMode ? (
              <button
                type="button"
                className="mark-read-btn"
                onClick={onMarkAsRead}
              >
                <CheckCircle2 size={18} />
                <span>통독 완료</span>
              </button>
            ) : (
              <button
                type="button"
                className={cn('mark-read-btn w-full max-w-none', currentChapterRead && 'is-read')}
                onClick={onMarkAsRead}
              >
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>{currentChapterRead ? '읽음 완료' : '읽음으로 표시'}</span>
              </button>
            )}

            {/* Book progress (non-tongdok mode) */}
            {!tongdokMode && bookProgress.total > 0 ? (
              <div className="flex flex-col items-center gap-2 w-full max-w-[260px] p-4 bg-[var(--color-bg-secondary)] rounded-[14px] border border-[var(--color-border-light)] dark:border-white/[.08]">
                <span className="text-[0.8125rem] font-semibold text-[var(--color-text-primary)] whitespace-nowrap tracking-tight">
                  {bookName} 읽기 진도
                </span>
                <div className="book-progress-bar">
                  <div
                    className="book-progress-fill"
                    style={{ width: `${bookProgress.total > 0 ? Math.round((bookProgress.read / bookProgress.total) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap tracking-tight">
                  {bookProgress.read} / {bookProgress.total}장{' '}
                  <span className="text-[var(--color-accent-primary)] font-semibold">
                    ({bookProgress.total > 0 ? Math.round((bookProgress.read / bookProgress.total) * 100) : 0}%)
                  </span>
                </span>
              </div>
            ) : null}

            {/* Tongdok range info */}
            {tongdokMode ? (
              <div className="text-xs text-[var(--color-text-tertiary)] text-center">
                <p className="font-medium">{tongdokRangeText}</p>
                <p className="mt-0.5">
                  진행: {tongdokProgress.completed}/{tongdokProgress.total}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Spacer for floating nav */}
        <div className="h-24" />
      </div>

      {/* ===== Floating Bottom Navigation ===== */}
      <div className="bible-floating-nav">
        <nav className="flex items-center justify-between px-2 py-2 min-h-[46px] gap-2">
          {/* Home */}
          <Link
            href="/"
            className="flex items-center justify-center w-8 h-8 text-[var(--color-text-tertiary)] rounded-lg transition-all hover:text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-light)] active:scale-[0.92] no-underline shrink-0"
          >
            <Home size={16} aria-hidden="true" />
          </Link>

          {/* Center: prev / chapter-info / next */}
          <div className="flex items-center justify-center gap-1 flex-1 min-w-0 overflow-hidden">
            <button
              type="button"
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-md transition-all bg-transparent border-none cursor-pointer shrink-0',
                hasPrevChapter
                  ? 'text-[var(--color-text-secondary)] hover:scale-[1.15] hover:text-[var(--color-accent-primary)] active:scale-95'
                  : 'text-[var(--color-text-muted)] opacity-50 cursor-not-allowed',
              )}
              disabled={!hasPrevChapter}
              onClick={onPrevChapter}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="chapter-info-btn"
              onClick={onOpenBookSelector}
            >
              <span className="font-semibold text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden text-ellipsis">
                {bookName} {chapter}장
              </span>
            </button>

            <button
              type="button"
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-md transition-all bg-transparent border-none cursor-pointer shrink-0',
                hasNextChapter
                  ? 'text-[var(--color-text-secondary)] hover:scale-[1.15] hover:text-[var(--color-accent-primary)] active:scale-95'
                  : 'text-[var(--color-text-muted)] opacity-50 cursor-not-allowed',
              )}
              disabled={!hasNextChapter}
              onClick={onNextChapter}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Profile */}
          <Link
            href="/profile"
            className="flex items-center justify-center w-8 h-8 text-[var(--color-text-tertiary)] rounded-lg transition-all hover:text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-light)] active:scale-[0.92] no-underline shrink-0"
          >
            <User size={16} aria-hidden="true" />
          </Link>
        </nav>
      </div>

      {/* ===== Verse Action Menu ===== */}
      {isMenuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/0"
            aria-label="본문 작업 메뉴 닫기"
            onClick={() => setIsMenuOpen(false)}
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
            onClose={() => setIsMenuOpen(false)}
          />
        </>
      ) : null}
    </div>
  )
}
