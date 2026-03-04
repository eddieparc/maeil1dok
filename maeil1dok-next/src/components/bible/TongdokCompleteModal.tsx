'use client'

import { useEffect, useState } from 'react'

interface TongdokCompleteModalProps {
  isOpen: boolean
  onClose: () => void
  scheduleRange: string
  initialAutoComplete?: boolean
  isLoading?: boolean
  onConfirm: (autoComplete: boolean) => void
}

export default function TongdokCompleteModal({
  isOpen,
  onClose,
  scheduleRange,
  initialAutoComplete = false,
  isLoading = false,
  onConfirm,
}: TongdokCompleteModalProps) {
  const [autoComplete, setAutoComplete] = useState(initialAutoComplete)

  useEffect(() => {
    if (isOpen) {
      setAutoComplete(initialAutoComplete)
    }
  }, [isOpen, initialAutoComplete])

  if (!isOpen) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-sm -translate-y-1/2 overflow-hidden rounded-3xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] shadow-[0_24px_64px_-28px_rgba(0,0,0,0.55)]">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 pb-10 pt-8 text-white">
          <div className="flex justify-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
              <svg className="relative h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12l2.5 2.5L16 9" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Tongdok</p>
          <h2 className="mt-1 text-center text-xl font-extrabold">오늘 분량을 다 읽으셨어요?</h2>
          <p className="mt-2 text-center text-sm text-emerald-50/90">말씀을 끝까지 읽은 순간을 기록해요</p>
        </div>

        <div className="-mt-5 px-6 pb-6">
          <div className="rounded-2xl border border-emerald-100 bg-[var(--color-bg-primary)] px-4 py-3 text-center text-sm font-semibold text-[var(--color-text-primary)] dark:border-emerald-500/20">
            {scheduleRange}
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-3 transition-colors hover:border-emerald-300/70 dark:hover:border-emerald-500/40">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-emerald-600"
              checked={autoComplete}
              onChange={(e) => setAutoComplete(e.target.checked)}
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">다음부터 자동으로 완료 처리</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">마지막 장을 읽으면 바로 완료돼요</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${autoComplete ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'}`}>
              {autoComplete ? '켜짐' : '꺼짐'}
            </span>
          </label>

          {autoComplete ? (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">설정 &gt; 읽기 설정에서 변경할 수 있습니다</p>
          ) : null}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-sm font-bold text-white shadow-[0_10px_22px_-12px_rgba(5,150,105,0.9)] transition hover:from-emerald-600 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onConfirm(autoComplete)}
              disabled={isLoading}
            >
              {isLoading ? '처리 중...' : '완료 처리'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
