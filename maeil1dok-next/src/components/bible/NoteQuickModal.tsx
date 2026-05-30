'use client'

import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { BIBLE_BOOKS } from '@/lib/bible/books'

interface NoteQuickModalProps {
  isOpen: boolean
  onClose: () => void
  book: string
  chapter: number
  verse?: number
  onSave: (content: string) => void
}

export default function NoteQuickModal({ isOpen, onClose, book, chapter, verse, onSave }: NoteQuickModalProps) {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setContent('')
      const timer = setTimeout(() => textareaRef.current?.focus(), 250)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  function handleSave() {
    if (!content.trim()) return
    onSave(content.trim())
    setContent('')
    onClose()
  }

  const bookInfo = BIBLE_BOOKS[book]
  const locationLabel = bookInfo
    ? `${bookInfo.ko} ${chapter}${book === 'psa' ? '편' : '장'}${verse ? ` ${verse}절` : ''}`
    : `${book} ${chapter}${verse ? `:${verse}` : ''}`

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="px-5 pt-5 pb-1">
        <h2 className="text-center text-lg font-semibold text-[var(--color-text-primary)]">
          빠른 메모
        </h2>
      </div>

      <div className="px-5 py-4">
        {/* Location info */}
        <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2.5 text-sm font-medium text-[var(--color-brand)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          <span>{locationLabel}</span>
        </div>

        {/* Textarea with char count */}
        <div className="relative mb-3">
          <textarea
            ref={textareaRef}
            className={cn(
              'w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors',
              'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]',
              'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
              'focus:border-[var(--color-ink)] focus:ring-2 focus:ring-[var(--color-ink)]/10',
              'min-h-[120px]'
            )}
            rows={4}
            maxLength={2000}
            placeholder="묵상 내용을 적어보세요..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <span className="absolute bottom-2 right-3 text-xs text-[var(--color-text-muted)]">
            {content.length}/2000
          </span>
        </div>

      </div>

      {/* Footer */}
      <div className="flex gap-2 border-t border-[var(--color-border-default)] px-5 py-4">
        <button
          type="button"
          className={cn(
            'flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors',
            'bg-[var(--color-button-default)] text-[var(--color-text-primary)]',
            'hover:bg-[var(--color-button-hover)]'
          )}
          onClick={onClose}
        >
          취소
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors',
            'bg-[var(--color-ink)] hover:bg-[var(--color-brand-deep)]',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          onClick={handleSave}
          disabled={!content.trim()}
        >
          저장
        </button>
      </div>
    </Modal>
  )
}
