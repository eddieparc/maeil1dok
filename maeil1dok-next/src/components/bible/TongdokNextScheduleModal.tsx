'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'

export type TongdokNextScheduleAction = 'go-next-schedule' | 'cancel'

interface TongdokNextScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  scheduleRange: string
  nextScheduleText?: string
  isLoading?: boolean
  onAction: (action: TongdokNextScheduleAction, remember: boolean) => void
}

export default function TongdokNextScheduleModal({
  isOpen,
  onClose,
  scheduleRange,
  nextScheduleText,
  isLoading = false,
  onAction,
}: TongdokNextScheduleModalProps) {
  const [remember, setRemember] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setRemember(false)
    }
  }, [isOpen])

  const handleClose = () => {
    onAction('cancel', remember)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="sm">
      <Modal.Body className="px-5 py-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <title>통독 완료</title>
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12l2.5 2.5L16 9" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">통독 완료!</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{scheduleRange}</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">다음 통독 일정으로 이동할까요?</p>

        {nextScheduleText ? (
          <p className="mt-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]">
            다음 일정: {nextScheduleText}
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          <button
            type="button"
            className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={() => onAction('go-next-schedule', remember)}
          >
            {isLoading ? '이동 중...' : '다음 통독 일정으로'}
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)]"
            disabled={isLoading}
            onClick={handleClose}
          >
            현재 위치 유지
          </button>
        </div>

        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-600"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>이 선택을 기억하기</span>
        </label>
        {remember ? (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">설정 &gt; 읽기 설정에서 변경할 수 있습니다</p>
        ) : null}
      </Modal.Body>
    </Modal>
  )
}
