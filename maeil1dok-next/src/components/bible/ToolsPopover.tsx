'use client'

import { useEffect, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck, BookOpen, Ellipsis, Headphones, List, NotebookPen, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolsPopoverProps {
  noteCount?: number
  isBookmarked?: boolean
  tongdokMode?: boolean
  audioLink?: string | null
  guideLink?: string | null
  onOpenNote?: () => void
  onOpenBookmarkList?: () => void
  onOpenSettings?: () => void
  onToggleBookmark?: () => void
  onAudioLinkClick?: (url: string) => void
  onReadingPlanClick?: () => void
}

function Divider() {
  return <div className="my-1 border-t border-[var(--color-border-default)]" />
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  badge?: number
  active?: boolean
  onClick: () => void
  className?: string
}

function MenuItem({ icon, label, badge, active, onClick, className }: MenuItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors',
        'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]',
        active && 'text-[var(--color-accent-primary)]',
        className,
      )}
      onClick={onClick}
    >
      <span className="text-[var(--color-text-secondary)]">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 ? (
        <span className="text-xs font-semibold text-[var(--color-accent-primary)]">{badge}</span>
      ) : null}
    </button>
  )
}

export default function ToolsPopover({
  noteCount = 0,
  isBookmarked = false,
  tongdokMode = false,
  audioLink,
  guideLink,
  onOpenNote,
  onOpenBookmarkList,
  onOpenSettings,
  onToggleBookmark,
  onAudioLinkClick,
  onReadingPlanClick,
}: ToolsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isOpen])

  const close = () => setIsOpen(false)

  const hasMobileItems = tongdokMode && (audioLink || guideLink)

  return (
    <div ref={popoverRef} className="relative">
      {/* 트리거 버튼 */}
      <button
        type="button"
        className={cn(
          'tool-trigger-button',
          'flex items-center justify-center rounded-lg p-2 transition-all',
          'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
          isOpen && 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]',
        )}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="도구"
        aria-expanded={isOpen}
      >
        <Ellipsis size={18} aria-hidden="true" />
        {noteCount > 0 ? (
          <span className="indicator-dot absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-accent-primary)]" />
        ) : null}
      </button>

      {/* 팝오버 */}
      {isOpen ? (
        <div
          className={cn(
            'absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl',
            'border border-[var(--color-border-default)]',
            'bg-[var(--color-bg-secondary)]/90 backdrop-blur-[12px]',
            'shadow-lg',
            'animate-in fade-in slide-in-from-top-2 duration-150',
          )}
          role="menu"
          aria-label="도구 메뉴"
        >
          {/* 듣기 (통독 모드 + 모바일에서만) */}
          {tongdokMode && audioLink ? (
            <MenuItem
              icon={<Headphones size={16} />}
              label="듣기"
              className="md:hidden"
              onClick={() => { onAudioLinkClick?.(audioLink); close() }}
            />
          ) : null}

          {/* 가이드 (통독 모드 + 모바일에서만) */}
          {tongdokMode && guideLink ? (
            <a
              href={guideLink}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors md:hidden',
                'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] no-underline',
              )}
              onClick={close}
            >
              <span className="text-[var(--color-text-secondary)]"><BookOpen size={16} /></span>
              <span>가이드</span>
            </a>
          ) : null}

          {hasMobileItems ? <Divider /> : null}

          {/* 성경통독표 */}
          <MenuItem
            icon={<List size={16} />}
            label="성경통독표"
            onClick={() => { onReadingPlanClick?.(); close() }}
          />

          <Divider />

          {/* 노트 */}
          <MenuItem
            icon={<NotebookPen size={16} />}
            label="노트"
            badge={noteCount}
            onClick={() => { onOpenNote?.(); close() }}
          />

          {/* 북마크 토글 (통독 모드에서만) */}
          {tongdokMode ? (
            <MenuItem
              icon={isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              label={isBookmarked ? '북마크 삭제' : '북마크 추가'}
              active={isBookmarked}
              onClick={() => { onToggleBookmark?.(); close() }}
            />
          ) : null}

          {/* 북마크 목록 */}
          <MenuItem
            icon={<Bookmark size={16} />}
            label="북마크 목록"
            onClick={() => { onOpenBookmarkList?.(); close() }}
          />

          <Divider />

          {/* 읽기 설정 */}
          <MenuItem
            icon={<Settings size={16} />}
            label="읽기 설정"
            onClick={() => { onOpenSettings?.(); close() }}
          />
        </div>
      ) : null}
    </div>
  )
}
