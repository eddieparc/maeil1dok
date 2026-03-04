'use client'

import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

const DEFAULT_COLORS = [
  '#FEF3C7', '#FDE68A', '#FFEB3B',
  '#D1FAE5', '#A5D6A7', '#6EE7B7',
  '#DBEAFE', '#90CAF9', '#93C5FD',
  '#FCE7F3', '#F48FB1', '#F9A8D4',
  '#FED7AA', '#FFCC80', '#FDBA74',
  '#E9D5FF', '#CE93D8', '#C4B5FD',
]

interface HighlightModalProps {
  isOpen: boolean
  onClose: () => void
  selectedColor?: string
  customColors?: string[]
  onSave: (color: string, memo?: string) => void
  onDelete?: () => void
}

export default function HighlightModal({
  isOpen,
  onClose,
  selectedColor,
  customColors = [],
  onSave,
  onDelete,
}: HighlightModalProps) {
  const [color, setColor] = useState(selectedColor ?? DEFAULT_COLORS[0])
  const [memo, setMemo] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setColor(selectedColor ?? DEFAULT_COLORS[0])
      setMemo('')
      // Focus textarea after animation
      const timer = setTimeout(() => textareaRef.current?.focus(), 250)
      return () => clearTimeout(timer)
    }
  }, [isOpen, selectedColor])

  const allColors = [...new Set([...DEFAULT_COLORS, ...customColors])]

  function handleSave() {
    onSave(color, memo.trim() || undefined)
    setMemo('')
    onClose()
  }

  function handleDelete() {
    onDelete?.()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="px-5 pt-5 pb-1">
        <h2 className="text-center text-lg font-semibold text-[var(--color-text-primary)]">
          하이라이트
        </h2>
      </div>

      <div className="px-5 py-4">
        {/* Color palette */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-medium text-[var(--color-text-tertiary)]">
            색상 선택
          </label>
          <div className="flex flex-wrap gap-2">
            {allColors.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition-all duration-200 hover:scale-110',
                  color === c
                    ? 'border-[var(--color-accent-primary)] shadow-[0_0_0_2px_var(--color-bg-primary),0_0_0_4px_var(--color-accent-primary)]'
                    : 'border-transparent dark:border-white/20'
                )}
                style={{ backgroundColor: c }}
                aria-label={`색상 ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        {/* Preview strip */}
        <div
          className="mb-4 rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)]"
          style={{ backgroundColor: color + '40' }}
        >
          <span className="font-medium" style={{ color }}>●</span>
          <span className="ml-2">선택한 색상 미리보기</span>
        </div>

        {/* Memo */}
        <div className="mb-2">
          <label className="mb-2 block text-xs font-medium text-[var(--color-text-tertiary)]">
            메모 (선택)
          </label>
          <textarea
            ref={textareaRef}
            className={cn(
              'w-full resize-none rounded-xl border px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors',
              'border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]',
              'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
              'focus:border-[var(--color-accent-primary)] focus:bg-[var(--color-bg-secondary)]',
              'focus:ring-2 focus:ring-[var(--color-accent-primary)]/10'
            )}
            rows={2}
            maxLength={500}
            placeholder="하이라이트에 메모를 추가하세요..."
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--color-border-default)] px-5 py-4">
        {onDelete ? (
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              'border-[var(--color-danger)]/30 text-[var(--color-danger)]',
              'hover:bg-[var(--color-danger)]/10'
            )}
            onClick={handleDelete}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            삭제
          </button>
        ) : (
          <div />
        )}

        <div className="flex gap-2">
          <button
            type="button"
            className={cn(
              'rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
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
              'rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors',
              'bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)]'
            )}
            onClick={handleSave}
          >
            {onDelete ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
