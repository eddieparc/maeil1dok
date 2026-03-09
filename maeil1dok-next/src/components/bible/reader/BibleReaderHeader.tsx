'use client'

import Link from 'next/link'
import { Bookmark, BookOpen, Ellipsis, Headphones, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BibleReaderHeaderProps {
  bookName: string
  shortBookName: string
  chapter: number
  tongdokMode: boolean
  isBookmarked: boolean
  noteCount: number
  audioLink: string | null
  guideLink: string | null
  onOpenBookSelector: () => void
  onDisableTongdokMode: () => void
  onToggleBookmark: () => void
  onOpenBookmarkModal: () => void
  onOpenSettingsModal: () => void
  onAudioLinkClick: (url: string) => void
}

export default function BibleReaderHeader({
  bookName,
  shortBookName,
  chapter,
  tongdokMode,
  isBookmarked,
  noteCount,
  audioLink,
  guideLink,
  onOpenBookSelector,
  onDisableTongdokMode,
  onToggleBookmark,
  onOpenBookmarkModal,
  onOpenSettingsModal,
  onAudioLinkClick,
}: BibleReaderHeaderProps) {
  return (
    <header className="bible-reader-header">
      {/* Left: Book selector */}
      {tongdokMode ? (
        /* 통독 mode: [dot] [book chapter] [x] */
        <div className="flex flex-1 items-center gap-1 min-w-0">
          <button
            type="button"
            aria-label={`${bookName} ${chapter}장 선택`}
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
            aria-label="통독모드 종료"
            className="flex items-center justify-center w-6 h-6 text-[var(--color-text-tertiary)] rounded hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-button-default)] active:scale-90 transition-all shrink-0"
            onClick={onDisableTongdokMode}
            title="통독모드 종료"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        /* Normal mode: [book chapter] [bookmark] */
        <div className="flex flex-1 items-center gap-1 min-w-0">
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
          </button>
          <button
            type="button"
            className={cn(
              'flex items-center justify-center transition-colors bg-transparent border-none p-1 cursor-pointer active:scale-95',
              isBookmarked ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-tertiary)]'
            )}
            onClick={(e) => {
              e.stopPropagation()
              if (isBookmarked) {
                onToggleBookmark()
              } else {
                onOpenBookmarkModal()
              }
            }}
            aria-label={isBookmarked ? '북마크 삭제' : '북마크 추가'}
          >
            <Bookmark size={18} aria-hidden="true" fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>
      )}

      {/* Center: Tongdok action buttons (audio/guide) */}
      {tongdokMode ? (
        <div className="flex flex-1 items-center justify-end gap-0.5">
          {audioLink ? (
            <button
              type="button"
              aria-label="오디오 듣기"
              className="flex items-center gap-1 px-2 py-1 text-[var(--color-text-secondary)] bg-transparent border-none rounded-md text-xs font-medium transition-all hover:bg-[var(--color-button-default)] hover:text-[var(--color-text-primary)] active:scale-95 cursor-pointer whitespace-nowrap"
              title="오디오"
              onClick={() => onAudioLinkClick(audioLink)}
            >
              <Headphones size={16} aria-hidden="true" />
              <span className="tongdok-action-text">듣기</span>
            </button>
          ) : null}
          {guideLink ? (
            <a
              href={guideLink}
              target="_blank"
              rel="noreferrer"
              aria-label="가이드 보기"
              className="flex items-center gap-1 px-2 py-1 text-[var(--color-text-secondary)] border-none rounded-md text-xs font-medium transition-all hover:bg-[var(--color-button-default)] hover:text-[var(--color-text-primary)] active:scale-95 cursor-pointer whitespace-nowrap no-underline"
              title="가이드"
            >
              <BookOpen size={16} aria-hidden="true" />
              <span className="tongdok-action-text">가이드</span>
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-1">
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
  )
}
