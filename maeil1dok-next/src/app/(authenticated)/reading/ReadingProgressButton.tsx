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
      }
      setShowSuccess(true)
    } catch {
      setErrorMessage('진행 상태를 업데이트하지 못했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  const buttonLabel = showSuccess
    ? isCompleted ? '✓ 완료!' : '취소됨'
    : isLoading
      ? '로딩 중...'
      : isCompleted
        ? '읽기 완료 ✓'
        : '읽기 완료하기'

  return (
    <div className="space-y-3">
      <button
        type="button"
        data-testid="progress-button"
        onClick={handleClick}
        disabled={isLoading}
        className={`relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
          showSuccess
            ? 'scale-105 bg-emerald-400/30 text-white backdrop-blur-sm'
            : isCompleted
              ? 'bg-white/25 text-white backdrop-blur-sm hover:bg-white/30'
              : 'bg-white text-indigo-900 hover:bg-white/90'
        }`}
      >
        {isLoading ? (
          <span className="animate-pulse">{buttonLabel}</span>
        ) : (
          buttonLabel
        )}
      </button>
      {errorMessage ? <p className="text-sm text-red-300">{errorMessage}</p> : null}
    </div>
  )
}
