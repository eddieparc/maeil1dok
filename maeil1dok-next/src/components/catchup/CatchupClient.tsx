'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateCatchupSchedule, type CatchupScheduleOutput } from '@/lib/catchup/scheduling'
import type { CatchupSession, DailySchedule } from '@/types'
import { CatchupSettingsModal, type CatchupSettings } from './CatchupSettingsModal'
import { CatchupPreviewModal } from './CatchupPreviewModal'
import { CatchupProgressCard } from './CatchupProgressCard'
import { TodayCatchupList, type TodayCatchupItem } from './TodayCatchupList'

interface CatchupClientProps {
  planId: number | null
  missedCount: number
  missedSchedules: DailySchedule[]
  activeSession: CatchupSession | null
  todayReadings: TodayCatchupItem[]
  progress: {
    completedCount: number
    totalCount: number
    estimatedCompletionDate: string | null
  }
}

function defaultTargetDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  return date.toISOString().slice(0, 10)
}

export function CatchupClient({
  planId,
  missedCount,
  missedSchedules,
  activeSession,
  todayReadings,
  progress,
}: CatchupClientProps) {
  const router = useRouter()

  const [session, setSession] = useState(activeSession)
  const [todayItems, setTodayItems] = useState(todayReadings)
  const [progressState, setProgressState] = useState(progress)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewSchedule, setPreviewSchedule] = useState<CatchupScheduleOutput | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isAbandoning, setIsAbandoning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<CatchupSettings>({
    strategy: 'parallel',
    targetDate: defaultTargetDate(),
    maxDailyReadings: 3,
    maxDailyChapters: 5,
    weekendMultiplier: 1.5,
  })

  const canStartCatchup = useMemo(() => !session && missedCount > 0 && planId !== null, [session, missedCount, planId])

  const handlePreview = (nextSettings: CatchupSettings) => {
    setSettings(nextSettings)
    setError(null)

    const target = new Date(`${nextSettings.targetDate}T00:00:00`)
    if (Number.isNaN(target.getTime())) {
      setError('목표일을 확인해주세요')
      return
    }

    const output = generateCatchupSchedule({
      missedSchedules,
      strategy: nextSettings.strategy,
      targetRejoinDate: target,
      maxDailyReadings: nextSettings.maxDailyReadings,
      maxDailyChapters: nextSettings.maxDailyChapters,
      weekendMultiplier: nextSettings.weekendMultiplier,
      startDate: new Date(),
    })

    setPreviewSchedule(output)
    setIsPreviewOpen(true)
  }

  const handleConfirmCreate = async () => {
    if (!planId) {
      setError('활성 플랜이 없습니다')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/catchup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          strategy: settings.strategy,
          targetDate: settings.targetDate,
          maxDailyReadings: settings.maxDailyReadings,
          maxDailyChapters: settings.maxDailyChapters,
          weekendMultiplier: settings.weekendMultiplier,
        }),
      })

      if (!response.ok) {
        throw new Error('failed')
      }

      router.refresh()
      setIsPreviewOpen(false)
      setIsSettingsOpen(false)
    } catch {
      setError('캐치업 세션을 생성하지 못했습니다')
    } finally {
      setIsCreating(false)
    }
  }

  const handleAbandon = async () => {
    if (!session) return

    setIsAbandoning(true)
    setError(null)
    try {
      const response = await fetch('/api/catchup/abandon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })

      if (!response.ok) {
        throw new Error('failed')
      }

      setSession(null)
      setTodayItems([])
      setProgressState({ completedCount: 0, totalCount: 0, estimatedCompletionDate: null })
      router.refresh()
    } catch {
      setError('세션 중단 처리에 실패했습니다')
    } finally {
      setIsAbandoning(false)
    }
  }

  const handleItemCompleted = (itemId: string) => {
    setTodayItems((previous) => previous.map((item) => (item.id === itemId ? { ...item, isCompleted: true } : item)))

    setProgressState((previous) => {
      const nextCompletedCount = Math.min(previous.totalCount, previous.completedCount + 1)
      return {
        ...previous,
        completedCount: nextCompletedCount,
      }
    })
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6">
      {!session ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.12em] text-gray-500">CATCHUP</p>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">밀린 통독 따라잡기</h1>
          <p className="mt-2 text-sm text-gray-600">미완료 일정 {missedCount}개</p>

          <button
            type="button"
            disabled={!canStartCatchup}
            onClick={() => setIsSettingsOpen(true)}
            className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            캐치업 시작
          </button>

          {missedCount === 0 ? <p className="mt-2 text-xs text-emerald-700">현재 밀린 일정이 없습니다.</p> : null}
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        </section>
      ) : (
        <>
          <CatchupProgressCard
            session={session}
            completedCount={progressState.completedCount}
            totalCount={progressState.totalCount}
            estimatedCompletionDate={progressState.estimatedCompletionDate}
          />

          <TodayCatchupList items={todayItems} onItemCompleted={handleItemCompleted} />

          <button
            type="button"
            onClick={handleAbandon}
            disabled={isAbandoning}
            className="w-full rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
          >
            {isAbandoning ? '중단 중...' : '캐치업 세션 중단'}
          </button>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </>
      )}

      <CatchupSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onPreview={handlePreview}
        value={settings}
        onChange={setSettings}
      />

      <CatchupPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        schedule={previewSchedule}
        onConfirm={handleConfirmCreate}
        isSubmitting={isCreating}
      />
    </div>
  )
}
