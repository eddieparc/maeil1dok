'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

interface TongdokCompleteModalProps {
  isOpen: boolean
  onClose: () => void
  scheduleRange: string
  initialAutoComplete?: boolean
  isLoading?: boolean
  isCelebrating?: boolean
  onConfirm: (autoComplete: boolean) => void
}

export default function TongdokCompleteModal({
  isOpen,
  onClose,
  scheduleRange,
  initialAutoComplete = false,
  isLoading = false,
  isCelebrating = false,
  onConfirm,
}: TongdokCompleteModalProps) {
  const [autoComplete, setAutoComplete] = useState(initialAutoComplete)

  useEffect(() => {
    if (isOpen) {
      setAutoComplete(initialAutoComplete)
    }
  }, [isOpen, initialAutoComplete])

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <Modal.Body className="px-5 py-5">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
            <svg className={cn('h-7 w-7', isCelebrating && 'animate-pulse')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>완료</title>
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12l2.5 2.5L16 9" />
            </svg>
          </div>

          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {isCelebrating ? '통독 완료!' : '오늘 분량을 다 읽으셨나요?'}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{scheduleRange}</p>

          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-600"
              checked={autoComplete}
              onChange={(e) => setAutoComplete(e.target.checked)}
            />
            <span>다음부터 자동으로 완료 처리</span>
          </label>

          {autoComplete ? (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">설정 &gt; 읽기 설정에서 변경할 수 있습니다</p>
          ) : null}
        </div>
      </Modal.Body>

      <Modal.Footer className="grid grid-cols-2 gap-2 border-t-0 px-5 pb-5 pt-0">
        <button
          type="button"
          className="rounded-lg bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-hover)]"
          onClick={onClose}
          disabled={isLoading || isCelebrating}
        >
          취소
        </button>
        <button
          type="button"
          className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onConfirm(autoComplete)}
          disabled={isLoading || isCelebrating}
        >
          {isLoading ? '처리 중...' : isCelebrating ? '완료!' : '완료 처리'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
