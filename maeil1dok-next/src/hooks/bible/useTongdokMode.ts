import { useEffect, useMemo, useState } from 'react'

interface TongdokSchedule {
  id: string
  plan_id: number
  date?: string
  book: string
  start_chapter: number
  end_chapter: number
  audio_link?: string | null
  guide_link?: string | null
}

interface TongdokProgress {
  id: string
  is_completed: boolean
  subscription_id?: string
}

interface TongdokStoredState {
  enabled: boolean
  scheduleId: string | null
  planId: string | null
  updatedAt: string
}

interface TongdokRange {
  startBook: string
  startChapter: number
  endBook: string
  endChapter: number
}

interface TongdokProgressCount {
  completed: number
  total: number
}

interface TongdokNextSchedule {
  id: string
  planId: string
  book: string
  chapter: number
  date: string
}

interface TongdokApiResponse<T> {
  data?: T
}

interface UseTongdokModeResult {
  tongdokMode: boolean
  tongdokScheduleId: string | null
  tongdokPlanId: string | null
  enableTongdokMode: (scheduleId: string, planId: string) => void
  disableTongdokMode: () => void
  loadReadingDetail: (planId: string) => Promise<void>
  getTongdokScheduleRange: () => TongdokRange | null
  isLastChapterInTongdok: (book: string, chapter: number) => boolean
  completeReading: () => Promise<boolean>
  getTongdokProgress: () => TongdokProgressCount
  isScheduleCompleted: () => boolean
  getAudioLink: (book: string, chapter: number) => string | null
  getGuideLink: (book: string, chapter: number) => string | null
  getNextScheduleSuggestion: () => TongdokNextSchedule | null
}

const STORAGE_KEY = 'tongdokModeState'

function toStoredState(
  enabled: boolean,
  scheduleId: string | null,
  planId: string | null,
): TongdokStoredState {
  return {
    enabled,
    scheduleId,
    planId,
    updatedAt: new Date().toISOString(),
  }
}

export function useTongdokMode(): UseTongdokModeResult {
  const [tongdokMode, setTongdokMode] = useState(false)
  const [tongdokScheduleId, setTongdokScheduleId] = useState<string | null>(null)
  const [tongdokPlanId, setTongdokPlanId] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<TongdokSchedule[]>([])
  const [progressList, setProgressList] = useState<TongdokProgress[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as TongdokStoredState
      if (parsed.enabled) {
        setTongdokMode(true)
        setTongdokScheduleId(parsed.scheduleId)
        setTongdokPlanId(parsed.planId)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const enableTongdokMode = (scheduleId: string, planId: string) => {
    setTongdokMode(true)
    setTongdokScheduleId(scheduleId)
    setTongdokPlanId(planId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStoredState(true, scheduleId, planId)))
  }

  const disableTongdokMode = () => {
    setTongdokMode(false)
    setTongdokScheduleId(null)
    setTongdokPlanId(null)
    setSchedules([])
    setProgressList([])
    localStorage.removeItem(STORAGE_KEY)
  }

  const loadReadingDetail = async (planId: string) => {
    const [scheduleResponse, progressResponse] = await Promise.all([
      fetch(`/api/bible/schedules?plan_id=${planId}`),
      fetch(`/api/bible/schedules/progress?plan_id=${planId}`),
    ])

    if (scheduleResponse.ok) {
      const scheduleJson = (await scheduleResponse.json()) as TongdokApiResponse<TongdokSchedule[]>
      setSchedules(scheduleJson.data ?? [])
    } else {
      setSchedules([])
    }

    if (progressResponse.ok) {
      const progressJson = (await progressResponse.json()) as TongdokApiResponse<TongdokProgress[]>
      setProgressList(progressJson.data ?? [])
    } else {
      setProgressList([])
    }
  }

  const range = useMemo<TongdokRange | null>(() => {
    if (schedules.length === 0) {
      return null
    }

    const first = schedules[0]
    const last = schedules[schedules.length - 1]
    if (!first || !last) {
      return null
    }

    return {
      startBook: first.book,
      startChapter: first.start_chapter,
      endBook: last.book,
      endChapter: last.end_chapter,
    }
  }, [schedules])

  const getTongdokScheduleRange = () => range

  const isLastChapterInTongdok = (book: string, chapter: number) => {
    if (!range) {
      return false
    }

    return range.endBook === book && range.endChapter === chapter
  }

  const getTongdokProgress = (): TongdokProgressCount => {
    if (schedules.length === 0) {
      return { completed: 0, total: 0 }
    }

    const completedIds = new Set(
      progressList
        .filter((entry) => entry.is_completed)
        .map((entry) => entry.id),
    )

    const total = schedules.reduce((sum, schedule) => {
      return sum + Math.max(schedule.end_chapter - schedule.start_chapter + 1, 0)
    }, 0)

    const completed = schedules.reduce((sum, schedule) => {
      if (!completedIds.has(schedule.id)) {
        return sum
      }
      return sum + Math.max(schedule.end_chapter - schedule.start_chapter + 1, 0)
    }, 0)

    return { completed, total }
  }

  const isScheduleCompleted = () => {
    if (!tongdokScheduleId) {
      return false
    }

    const current = progressList.find((entry) => entry.id === tongdokScheduleId)
    return current?.is_completed ?? false
  }

  const getAudioLink = (book: string, chapter: number) => {
    const match = schedules.find((schedule) => (
      schedule.book === book
      && chapter >= schedule.start_chapter
      && chapter <= schedule.end_chapter
    ))

    return match?.audio_link ?? null
  }

  const getGuideLink = (book: string, chapter: number) => {
    const match = schedules.find((schedule) => (
      schedule.book === book
      && chapter >= schedule.start_chapter
      && chapter <= schedule.end_chapter
    ))

    return match?.guide_link ?? null
  }

  const getNextScheduleSuggestion = (): TongdokNextSchedule | null => {
    if (!tongdokScheduleId || schedules.length === 0) {
      return null
    }

    const completedIds = new Set(
      progressList
        .filter((entry) => entry.is_completed)
        .map((entry) => entry.id),
    )
    completedIds.add(tongdokScheduleId)

    const sortedSchedules = [...schedules].sort((a, b) => {
      const dateCompare = (a.date ?? '').localeCompare(b.date ?? '')
      if (dateCompare !== 0) {
        return dateCompare
      }

      return a.id.localeCompare(b.id)
    })

    const currentIndex = sortedSchedules.findIndex((schedule) => schedule.id === tongdokScheduleId)
    const searchStart = currentIndex >= 0 ? currentIndex + 1 : 0

    for (let index = searchStart; index < sortedSchedules.length; index += 1) {
      const schedule = sortedSchedules[index]
      if (!completedIds.has(schedule.id)) {
        return {
          id: schedule.id,
          planId: String(schedule.plan_id),
          book: schedule.book,
          chapter: schedule.start_chapter,
          date: schedule.date ?? '',
        }
      }
    }

    return null
  }

  const completeReading = async () => {
    if (!tongdokScheduleId) {
      return false
    }

    const current = progressList.find((entry) => entry.id === tongdokScheduleId)
    const response = await fetch('/api/bible/schedules/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule_id: tongdokScheduleId,
        subscription_id: current?.subscription_id,
      }),
    })

    if (!response.ok) {
      return false
    }

    disableTongdokMode()
    return true
  }

  return {
    tongdokMode,
    tongdokScheduleId,
    tongdokPlanId,
    enableTongdokMode,
    disableTongdokMode,
    loadReadingDetail,
    getTongdokScheduleRange,
    isLastChapterInTongdok,
    completeReading,
    getTongdokProgress,
    isScheduleCompleted,
    getAudioLink,
    getGuideLink,
    getNextScheduleSuggestion,
  }
}
