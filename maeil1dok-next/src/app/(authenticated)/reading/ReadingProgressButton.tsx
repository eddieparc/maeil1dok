'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createClientRepositories } from '@/repositories/factory'

interface ReadingProgressButtonProps {
  scheduleId: string
  subscriptionId: string
  initialCompleted: boolean
}

export default function ReadingProgressButton({
  scheduleId,
  subscriptionId,
  initialCompleted,
}: ReadingProgressButtonProps) {
  const [isCompleted, setIsCompleted] = useState(initialCompleted)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const clearSuccess = useCallback(() => {
    setShowSuccess(false)
  }, [])

  useEffect(() => {
    if (!showSuccess) return
    const timer = setTimeout(clearSuccess, 1500)
    return () => clearTimeout(timer)
  }, [showSuccess, clearSuccess])

  const handleClick = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    setShowSuccess(false)

    try {
      const supabase = createClient()
      const repositories = createClientRepositories(supabase)

      if (isCompleted) {
        await repositories.progress.markIncomplete(subscriptionId, scheduleId)
        setIsCompleted(false)
      } else {
        await repositories.progress.markComplete(subscriptionId, scheduleId)
        setIsCompleted(true)

        // Fire-and-forget friend activity notification
        void fetch('/api/notifications/friend-activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityType: 'reading' }),
        }).catch(() => {
          /* ignore notification errors */
        })
      }
      setShowSuccess(true)
    } catch {
      setErrorMessage('진행 상태를 업데이트하지 못했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  const buttonLabel = showSuccess
    ? isCompleted
      ? '완료!'
      : '취소됨'
    : isLoading
      ? '저장 중...'
      : isCompleted
        ? '읽기 완료'
        : '읽기 완료하기'

  const variantClass = showSuccess
    ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)]'
    : isCompleted
      ? 'border border-[var(--color-rule)] bg-transparent text-[var(--color-ink)] hover:border-[var(--color-ink)]'
      : 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-brand-deep)]'

  return (
    <div className="space-y-2">
      <button
        type="button"
        data-testid="progress-button"
        onClick={handleClick}
        disabled={isLoading}
        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold -tracking-[0.012em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClass}`}
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        {showSuccess || isCompleted ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
        <span className={isLoading ? 'animate-pulse' : ''}>{buttonLabel}</span>
      </button>
      {errorMessage ? (
        <p
          className="text-[11px] font-medium text-[var(--color-danger)] -tracking-[0.005em]"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
