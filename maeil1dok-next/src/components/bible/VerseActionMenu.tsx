'use client'

import { BIBLE_BOOKS } from '@/lib/bible/books'

interface VerseActionMenuProps {
  book: string
  chapter: number
  version: string
  verseText?: string
  onClose: () => void
  position?: { x: number; y: number }
  onHighlight?: () => void
}

function buildMenuPositionStyle(position?: { x: number; y: number }) {
  if (!position) {
    return {
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
    }
  }

  if (typeof window === 'undefined') {
    return { top: position.y, left: position.x }
  }

  return {
    top: Math.max(position.y, 16),
    left: Math.min(Math.max(position.x, 16), window.innerWidth - 220),
  }
}

export function VerseActionMenu({
  book,
  chapter,
  version,
  verseText,
  onClose,
  position,
  onHighlight,
}: VerseActionMenuProps) {
  const bookInfo = BIBLE_BOOKS[book]
  const locationText = `${bookInfo?.ko ?? book} ${chapter}장`

  const copyLocation = async () => {
    await navigator.clipboard.writeText(locationText).catch(() => {})
    onClose()
  }

  const copyVerse = async () => {
    const text = (verseText ?? '').trim() || locationText
    await navigator.clipboard.writeText(text).catch(() => {})
    onClose()
  }

  const handleShare = async () => {
    const text = `${locationText} 읽기 중`
    const url = `${window.location.origin}/bible?book=${book}&chapter=${chapter}&version=${version}`
    const shareBody = (verseText ?? '').trim() ? `${verseText}\n\n${url}` : `${text} ${url}`

    if (navigator.share) {
      await navigator.share({ title: text, text: verseText, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(shareBody).catch(() => {})
    }

    onClose()
  }

  return (
    <div
      data-testid="verse-action-menu"
      className="fixed z-40 w-[200px] rounded-2xl bg-white p-2 shadow-lg"
      style={buildMenuPositionStyle(position)}
    >
      <button
        type="button"
        onClick={copyLocation}
        className="block w-full rounded-xl px-4 py-2 text-left text-sm hover:bg-gray-50"
      >
        📍 본문 위치 복사
      </button>
      <button
        type="button"
        onClick={copyVerse}
        className="block w-full rounded-xl px-4 py-2 text-left text-sm hover:bg-gray-50"
      >
        📄 본문 복사
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="block w-full rounded-xl px-4 py-2 text-left text-sm hover:bg-gray-50"
      >
        🔗 공유
      </button>
      {onHighlight ? (
        <button
          type="button"
          onClick={onHighlight}
          className="block w-full rounded-xl px-4 py-2 text-left text-sm hover:bg-gray-50"
        >
          🖍️ 하이라이트
        </button>
      ) : null}
    </div>
  )
}
