'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BIBLE_BOOKS } from '@/lib/bible/books'
import type { HighlightColor } from '@/types'
import './VerseActionMenu.css'

/* ------------------------------------------------------------------ */
/*  Highlight color palette (inline — no separate picker needed)      */
/* ------------------------------------------------------------------ */

const HIGHLIGHT_COLORS: Array<{
  color: HighlightColor
  bg: string
  ring: string
  label: string
}> = [
  { color: 'yellow', bg: 'bg-yellow-300', ring: 'ring-yellow-400', label: '노랑' },
  { color: 'green', bg: 'bg-green-300', ring: 'ring-green-400', label: '초록' },
  { color: 'blue', bg: 'bg-blue-300', ring: 'ring-blue-400', label: '파랑' },
  { color: 'pink', bg: 'bg-pink-300', ring: 'ring-pink-400', label: '분홍' },
  { color: 'purple', bg: 'bg-purple-300', ring: 'ring-purple-400', label: '보라' },
]

/* ------------------------------------------------------------------ */
/*  Inline SVG icons (Lucide-style, 16×16)                           */
/* ------------------------------------------------------------------ */

function PenIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 20h9" />
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z" />
    </svg>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Position calculator                                               */
/* ------------------------------------------------------------------ */

function computeMenuPosition(position?: { x: number; y: number }) {
  if (!position) {
    return {
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
    } as React.CSSProperties
  }

  if (typeof window === 'undefined') {
    return { top: position.y, left: position.x } as React.CSSProperties
  }

  const menuWidth = 280
  const menuHeight = 54
  const pad = 12

  let top = position.y - menuHeight - pad
  let left = position.x

  // Clamp horizontal
  left = Math.min(Math.max(left, pad + menuWidth / 2), window.innerWidth - menuWidth / 2 - pad)

  // Flip below if near top
  if (top < pad) {
    top = position.y + pad
  }

  return {
    top,
    left,
    transform: 'translateX(-50%)',
  } as React.CSSProperties
}

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface VerseActionMenuProps {
  book: string
  chapter: number
  version: string
  verseText?: string
  onClose: () => void
  position?: { x: number; y: number }
  isHighlighted?: boolean
  onHighlightSelect?: (color: HighlightColor) => void
  onRemoveHighlight?: () => void
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function VerseActionMenu({
  book,
  chapter,
  version,
  verseText,
  onClose,
  position,
  isHighlighted,
  onHighlightSelect,
  onRemoveHighlight,
}: VerseActionMenuProps) {
  const [showColors, setShowColors] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const bookInfo = BIBLE_BOOKS[book]
  const locationText = `${bookInfo?.ko ?? book} ${chapter}장`

  // Animate in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  /* ---------- Handlers ---------- */

  const handleCopy = async () => {
    const text = (verseText ?? '').trim() || locationText
    await navigator.clipboard.writeText(text).catch(() => {})
    onClose()
  }

  const handleShare = async () => {
    const text = `${locationText} 읽기 중`
    const url = `${window.location.origin}/bible?book=${book}&chapter=${chapter}&version=${version}`
    const shareBody = (verseText ?? '').trim()
      ? `${verseText}\n\n${url}`
      : `${text} ${url}`

    if (navigator.share) {
      await navigator.share({ title: text, text: verseText, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(shareBody).catch(() => {})
    }
    onClose()
  }

  const handleHighlightOrRemove = () => {
    if (isHighlighted && onRemoveHighlight) {
      onRemoveHighlight()
      onClose()
    } else if (onHighlightSelect) {
      setShowColors((p) => !p)
    }
  }

  const handleColorSelect = (color: HighlightColor) => {
    onHighlightSelect?.(color)
    onClose()
  }

  /* ---------- Render ---------- */

  const menu = (
    <div
      data-testid="verse-action-menu"
      ref={menuRef}
      className={[
        'verse-action-menu',
        isVisible ? 'verse-action-menu--visible' : '',
      ].join(' ')}
      style={computeMenuPosition(position)}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Main action row ── */}
      <div className="verse-action-row">
        {/* Highlight / Remove highlight */}
        {(onHighlightSelect || (isHighlighted && onRemoveHighlight)) ? (
          <button
            type="button"
            className={`verse-action-btn ${isHighlighted ? 'verse-action-btn--danger' : ''}`}
            onClick={handleHighlightOrRemove}
          >
            {isHighlighted ? (
              <>
                <TrashIcon className="verse-action-icon" />
                <span>제거</span>
              </>
            ) : (
              <>
                <PenIcon className="verse-action-icon" />
                <span>하이라이트</span>
              </>
            )}
          </button>
        ) : null}

        {/* Copy */}
        <button type="button" className="verse-action-btn" onClick={handleCopy}>
          <CopyIcon className="verse-action-icon" />
          <span>복사</span>
        </button>

        {/* Share */}
        <button type="button" className="verse-action-btn" onClick={handleShare}>
          <ShareIcon className="verse-action-icon" />
          <span>공유</span>
        </button>

        {/* Close */}
        <button
          type="button"
          className="verse-action-btn verse-action-btn--close"
          onClick={onClose}
          aria-label="닫기"
        >
          <XIcon />
        </button>
      </div>

      {/* ── Inline color picker (slides open) ── */}
      {showColors && !isHighlighted ? (
        <div className="verse-color-row">
          {HIGHLIGHT_COLORS.map((opt) => (
            <button
              key={opt.color}
              type="button"
              className={`verse-color-dot ${opt.bg} hover:${opt.ring}`}
              aria-label={`${opt.label} 하이라이트`}
              onClick={() => handleColorSelect(opt.color)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )

  // Portal to body for proper stacking context
  if (typeof window === 'undefined') return null
  return createPortal(menu, document.body)
}
