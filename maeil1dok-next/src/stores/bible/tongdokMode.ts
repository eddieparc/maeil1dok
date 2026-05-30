'use client'

import { persist } from 'zustand/middleware'
import { createStoreFactory, type StateCreator } from '@/lib/zustand/factory'
import { createStoreContext } from '@/lib/zustand/provider'

// ============================================
// Types
// ============================================

export interface TongdokSchedule {
  id: string
  plan_id: number
  date?: string
  book: string
  start_chapter: number
  end_chapter: number
  audio_link?: string | null
  guide_link?: string | null
}

export interface TongdokProgress {
  id: string
  is_completed: boolean
  subscription_id?: string
}

export interface TongdokRange {
  startBook: string
  startChapter: number
  endBook: string
  endChapter: number
}

export interface TongdokProgressCount {
  completed: number
  total: number
}

export interface TongdokNextSchedule {
  id: string
  planId: string
  book: string
  chapter: number
  date: string
}

interface TongdokModeData {
  tongdokMode: boolean
  scheduleId: string | null
  planId: string | null
  schedules: TongdokSchedule[]
  progressList: TongdokProgress[]
}

interface TongdokModeActions {
  enableTongdokMode: (scheduleId: string, planId: string) => void
  disableTongdokMode: () => void
  setSchedules: (schedules: TongdokSchedule[]) => void
  setProgressList: (progressList: TongdokProgress[]) => void
  loadReadingDetail: (planId: string) => Promise<void>
  completeReading: () => Promise<boolean>
  getTongdokScheduleRange: () => TongdokRange | null
  isLastChapterInTongdok: (book: string, chapter: number) => boolean
  getTongdokProgress: () => TongdokProgressCount
  isScheduleCompleted: () => boolean
  getAudioLink: (book: string, chapter: number) => string | null
  getGuideLink: (book: string, chapter: number) => string | null
  getNextScheduleSuggestion: () => TongdokNextSchedule | null
}

export type TongdokModeState = TongdokModeData & TongdokModeActions

// ============================================
// Selectors
// ============================================

export const tongdokModeSelectors = {
  scheduleRange: (state: TongdokModeState): TongdokRange | null => {
    if (state.schedules.length === 0) return null
    const first = state.schedules[0]
    const last = state.schedules[state.schedules.length - 1]
    if (!first || !last) return null
    return {
      startBook: first.book,
      startChapter: first.start_chapter,
      endBook: last.book,
      endChapter: last.end_chapter,
    }
  },

  progress: (state: TongdokModeState): TongdokProgressCount => {
    if (state.schedules.length === 0) return { completed: 0, total: 0 }
    const completedIds = new Set(
      state.progressList.filter((e) => e.is_completed).map((e) => e.id)
    )
    const total = state.schedules.reduce(
      (sum, s) => sum + Math.max(s.end_chapter - s.start_chapter + 1, 0),
      0
    )
    const completed = state.schedules.reduce((sum, s) => {
      if (!completedIds.has(s.id)) return sum
      return sum + Math.max(s.end_chapter - s.start_chapter + 1, 0)
    }, 0)
    return { completed, total }
  },
}

// ============================================
// Store Factory
// ============================================

const STORAGE_KEY = 'tongdok-mode-state'

export const createTongdokModeStore = createStoreFactory<TongdokModeState>(
  persist(
    (set, get) => ({
      tongdokMode: false,
      scheduleId: null,
      planId: null,
      schedules: [],
      progressList: [],

      enableTongdokMode: (scheduleId: string, planId: string) => {
        set({ tongdokMode: true, scheduleId, planId })
      },

      disableTongdokMode: () => {
        set({
          tongdokMode: false,
          scheduleId: null,
          planId: null,
          schedules: [],
          progressList: [],
        })
      },

      setSchedules: (schedules: TongdokSchedule[]) => {
        set({ schedules })
      },

      setProgressList: (progressList: TongdokProgress[]) => {
        set({ progressList })
      },

      loadReadingDetail: async (planId: string) => {
        const [scheduleResponse, progressResponse] = await Promise.all([
          fetch(`/api/bible/schedules?plan_id=${planId}`),
          fetch(`/api/bible/schedules/progress?plan_id=${planId}`),
        ])

        if (scheduleResponse.ok) {
          const json = (await scheduleResponse.json()) as { data?: TongdokSchedule[] }
          set({ schedules: json.data ?? [] })
        } else {
          set({ schedules: [] })
        }

        if (progressResponse.ok) {
          const json = (await progressResponse.json()) as { data?: TongdokProgress[] }
          set({ progressList: json.data ?? [] })
        } else {
          set({ progressList: [] })
        }
      },

      completeReading: async () => {
        const { scheduleId, progressList } = get()
        if (!scheduleId) return false

        const current = progressList.find((e) => e.id === scheduleId)
        const response = await fetch('/api/bible/schedules/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schedule_id: scheduleId,
            subscription_id: current?.subscription_id,
          }),
        })

        if (!response.ok) return false
        get().disableTongdokMode()
        return true
      },

      getTongdokScheduleRange: () => {
        return tongdokModeSelectors.scheduleRange(get())
      },

      isLastChapterInTongdok: (book: string, chapter: number) => {
        const range = tongdokModeSelectors.scheduleRange(get())
        if (!range) return false
        return range.endBook === book && range.endChapter === chapter
      },

      getTongdokProgress: () => {
        return tongdokModeSelectors.progress(get())
      },

      isScheduleCompleted: () => {
        const { scheduleId, progressList } = get()
        if (!scheduleId) return false
        const current = progressList.find((e) => e.id === scheduleId)
        return current?.is_completed ?? false
      },

      getAudioLink: (book: string, chapter: number) => {
        const match = get().schedules.find(
          (s) => s.book === book && chapter >= s.start_chapter && chapter <= s.end_chapter
        )
        return match?.audio_link ?? null
      },

      getGuideLink: (book: string, chapter: number) => {
        const match = get().schedules.find(
          (s) => s.book === book && chapter >= s.start_chapter && chapter <= s.end_chapter
        )
        return match?.guide_link ?? null
      },

      getNextScheduleSuggestion: () => {
        const { scheduleId, schedules, progressList } = get()
        if (!scheduleId || schedules.length === 0) return null

        const completedIds = new Set(
          progressList.filter((e) => e.is_completed).map((e) => e.id)
        )
        completedIds.add(scheduleId)

        const sorted = [...schedules].sort((a, b) => {
          const dateCompare = (a.date ?? '').localeCompare(b.date ?? '')
          if (dateCompare !== 0) return dateCompare
          return a.id.localeCompare(b.id)
        })

        const currentIndex = sorted.findIndex((s) => s.id === scheduleId)
        const searchStart = currentIndex >= 0 ? currentIndex + 1 : 0

        for (let i = searchStart; i < sorted.length; i++) {
          const schedule = sorted[i]
          if (schedule && !completedIds.has(schedule.id)) {
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
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        tongdokMode: state.tongdokMode,
        scheduleId: state.scheduleId,
        planId: state.planId,
      }),
    }
  ) as StateCreator<TongdokModeState>
)

// ============================================
// Context
// ============================================

const _tongdokModeContext = createStoreContext<TongdokModeState>()
export const TongdokModeProvider = _tongdokModeContext.StoreProvider
export const useTongdokMode = _tongdokModeContext.useStoreContext
export const useTongdokModeApi = _tongdokModeContext.useStoreApi
