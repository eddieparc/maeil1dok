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
  onSave: (content: string, isPrivate: boolean) => void
}

export default function NoteQuickModal({ isOpen, onClose, book, chapter, verse, onSave }: NoteQuickModalProps) {
  const [content, setContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setContent('')
      setIsPrivate(false)
      const timer = setTimeout(() => textareaRef.current?.focus(), 250)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  function handleSave() {
    if (!content.trim()) return
    onSave(content.trim(), isPrivate)
    setContent('')
    setIsPrivate(false)
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
        <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2.5 text-sm font-medium text-[var(--color-accent-primary)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              'focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/10',
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

        {/* Private toggle */}
        <label className="flex cursor-pointer items-center gap-2.5">
          <div className="relative">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
            />
            <div className={cn(
              'h-5 w-9 rounded-full transition-colors duration-200',
              'bg-[var(--color-border-default)] peer-checked:bg-[var(--color-accent-primary)]'
            )} />
            <div className={cn(
              'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
              'peer-checked:translate-x-4'
            )} />
          </div>
          <span className="text-sm text-[var(--color-text-secondary)]">비공개</span>
        </label>
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
            'bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)]',
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
