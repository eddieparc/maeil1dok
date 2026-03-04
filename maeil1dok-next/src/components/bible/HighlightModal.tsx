'use client'

import { useEffect, useState } from 'react'
import HighlightColorPicker from './HighlightColorPicker'
import { Modal } from '@/components/ui/Modal'
import { BIBLE_BOOKS } from '@/lib/bible/books'
import type { HighlightColor } from '@/types'

interface HighlightModalProps {
  isOpen: boolean
  onClose: () => void
  book?: string
  chapter?: number
  startVerse?: number
  endVerse?: number
  selectedColor?: HighlightColor
  onSave: (color: string, memo?: string) => void
  onDelete?: () => void
}

export default function HighlightModal({
  isOpen,
  onClose,
  book = 'gen',
  chapter = 1,
  startVerse = 1,
  endVerse = 1,
  selectedColor = 'yellow',
  onSave,
  onDelete,
}: HighlightModalProps) {
  const [color, setColor] = useState<HighlightColor>(selectedColor)
  const [memo, setMemo] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }
    setColor(selectedColor)
    setMemo('')
  }, [isOpen, selectedColor])

  const locationText = `${BIBLE_BOOKS[book]?.ko ?? book} ${chapter}${book === 'psa' ? '편' : '장'} ${startVerse}${startVerse !== endVerse ? `-${endVerse}` : ''}절`

  const handleSave = async () => {
    setIsSaving(true)
    try {
      onSave(color, memo.trim() || undefined)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="px-6 pt-6 pb-3">
        <h2 className="text-center text-lg font-semibold text-[var(--color-text-primary)]">하이라이트</h2>
      </div>

      <div className="px-6 pb-4">
        <div className="mb-5 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2.5 text-[0.9375rem] font-medium text-[var(--color-accent-primary)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          <span>{locationText}</span>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-[var(--color-text-tertiary)]">색상 선택</p>
          <HighlightColorPicker selectedColor={color} onSelect={setColor} />
        </div>

        <div>
          <label htmlFor="highlight-memo" className="mb-2 block text-xs font-medium text-[var(--color-text-tertiary)]">메모 (선택)</label>
          <textarea
            id="highlight-memo"
            rows={2}
            maxLength={500}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="하이라이트에 메모를 추가하세요..."
            className="w-full resize-none rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/10"
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-border-default)] px-6 py-4">
        {onDelete ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-danger)] px-3 py-2 text-sm font-medium text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/10"
            onClick={onDelete}
          >
            삭제
          </button>
        ) : <div />}

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-[var(--color-button-default)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-button-hover)]"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--color-accent-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            {onDelete ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
