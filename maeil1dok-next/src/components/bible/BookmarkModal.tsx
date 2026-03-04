'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { BIBLE_BOOKS } from '@/lib/bible/books'
import { cn } from '@/lib/utils'

interface BookmarkModalProps {
  isOpen: boolean
  onClose: () => void
  book: string
  chapter: number
  startVerse?: number
  endVerse?: number
  onSave: (data: { title: string; color: string; memo: string }) => Promise<void> | void
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6']

export default function BookmarkModal({
  isOpen,
  onClose,
  book,
  chapter,
  startVerse,
  endVerse,
  onSave,
}: BookmarkModalProps) {
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [isSaving, setIsSaving] = useState(false)

  const locationText = useMemo(() => {
    const bookName = BIBLE_BOOKS[book]?.ko ?? book
    if (startVerse && endVerse) {
      return startVerse === endVerse
        ? `${bookName} ${chapter}:${startVerse}`
        : `${bookName} ${chapter}:${startVerse}-${endVerse}`
    }

    return `${bookName} ${chapter}${book === 'psa' ? '편' : '장'}`
  }, [book, chapter, endVerse, startVerse])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setTitle('')
    setMemo('')
    setColor(COLORS[0])
  }, [isOpen])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({ title, color, memo })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="px-6 pt-6 pb-3">
        <h2 className="text-center text-lg font-semibold text-[var(--color-text-primary)]">북마크 추가</h2>
      </div>

      <div className="px-6 pb-4">
        <div className="mb-5 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2.5 text-[0.9375rem] font-medium text-[var(--color-accent-primary)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span>{locationText}</span>
        </div>

        <div className="mb-4">
          <label htmlFor="bookmark-title" className="mb-1.5 block text-xs font-medium text-[var(--color-text-tertiary)]">제목 (선택)</label>
          <input
            id="bookmark-title"
            type="text"
            value={title}
            maxLength={100}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="북마크 제목을 입력하세요"
            className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 py-2.5 text-[0.9375rem] text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/10"
          />
        </div>

        <fieldset className="mb-4">
          <legend className="mb-1.5 block text-xs font-medium text-[var(--color-text-tertiary)]">색상</legend>
          <div className="flex items-center gap-2">
            {COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition hover:scale-105',
                  color === swatch ? 'border-[var(--color-text-primary)] shadow-[0_0_0_2px_var(--color-bg-primary)]' : 'border-transparent'
                )}
                style={{ backgroundColor: swatch }}
                onClick={() => setColor(swatch)}
                aria-label="북마크 색상 선택"
              />
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="bookmark-memo" className="mb-1.5 block text-xs font-medium text-[var(--color-text-tertiary)]">메모 (선택)</label>
          <textarea
            id="bookmark-memo"
            value={memo}
            maxLength={500}
            rows={3}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="메모를 입력하세요"
            className="w-full resize-y rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 py-2.5 text-[0.9375rem] text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/10"
          />
        </div>
      </div>

      <div className="flex gap-2 border-t border-[var(--color-border-default)] px-6 py-4">
        <button
          type="button"
          className="flex-1 rounded-xl bg-[var(--color-button-default)] px-4 py-2.5 text-[0.9375rem] font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-button-hover)]"
          onClick={onClose}
        >
          취소
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl bg-[var(--color-accent-primary)] px-4 py-2.5 text-[0.9375rem] font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void handleSave()}
          disabled={isSaving}
        >
          저장
        </button>
      </div>
    </Modal>
  )
}
