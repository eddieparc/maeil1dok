'use client'

import { useState } from 'react'
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

  const handleClick = async () => {
    setIsLoading(true)
    setErrorMessage(null)

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
    } catch {
      setErrorMessage('진행 상태를 업데이트하지 못했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">
        상태: <span className="font-semibold text-gray-900">{isCompleted ? '완료' : '미완료'}</span>
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? '로딩 중...' : isCompleted ? '읽기 완료 ✓' : '읽기 완료'}
      </button>
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  )
}
