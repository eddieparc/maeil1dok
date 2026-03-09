import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTongdokModeStore, tongdokModeSelectors } from './tongdokMode'
import type { TongdokModeState, TongdokSchedule, TongdokProgress } from './tongdokMode'

vi.mock('zustand')

const mockSchedules: TongdokSchedule[] = [
  { id: 's1', plan_id: 1, book: 'gen', start_chapter: 1, end_chapter: 3, date: '2026-01-01' },
  { id: 's2', plan_id: 1, book: 'gen', start_chapter: 4, end_chapter: 6, date: '2026-01-02' },
  { id: 's3', plan_id: 1, book: 'gen', start_chapter: 7, end_chapter: 9, date: '2026-01-03' },
]

const mockProgressList: TongdokProgress[] = [
  { id: 's1', is_completed: true, subscription_id: 'sub1' },
  { id: 's2', is_completed: false },
]

describe('TongdokMode Store', () => {
  let store: ReturnType<typeof createTongdokModeStore>

  beforeEach(() => {
    store = createTongdokModeStore()
  })

  describe('초기 상태', () => {
    it('통독 모드가 비활성화 상태로 시작', () => {
      const state = store.getState()
      expect(state.tongdokMode).toBe(false)
      expect(state.scheduleId).toBeNull()
      expect(state.planId).toBeNull()
      expect(state.schedules).toHaveLength(0)
      expect(state.progressList).toHaveLength(0)
    })
  })

  describe('enableTongdokMode / disableTongdokMode', () => {
    it('통독 모드 진입 시 상태 설정', () => {
      store.getState().enableTongdokMode('schedule-1', 'plan-1')
      const state = store.getState()
      expect(state.tongdokMode).toBe(true)
      expect(state.scheduleId).toBe('schedule-1')
      expect(state.planId).toBe('plan-1')
    })

    it('통독 모드 종료 시 상태 초기화', () => {
      store.getState().enableTongdokMode('schedule-1', 'plan-1')
      store.getState().setSchedules(mockSchedules)
      store.getState().disableTongdokMode()
      const state = store.getState()
      expect(state.tongdokMode).toBe(false)
      expect(state.scheduleId).toBeNull()
      expect(state.planId).toBeNull()
      expect(state.schedules).toHaveLength(0)
    })
  })

  describe('setSchedules / setProgressList', () => {
    it('스케줄 목록 설정', () => {
      store.getState().setSchedules(mockSchedules)
      expect(store.getState().schedules).toHaveLength(3)
    })

    it('진행 목록 설정', () => {
      store.getState().setProgressList(mockProgressList)
      expect(store.getState().progressList).toHaveLength(2)
    })
  })

  describe('getTongdokScheduleRange', () => {
    it('스케줄 없을 때 null 반환', () => {
      expect(store.getState().getTongdokScheduleRange()).toBeNull()
    })

    it('스케줄 있을 때 범위 반환', () => {
      store.getState().setSchedules(mockSchedules)
      const range = store.getState().getTongdokScheduleRange()
      expect(range).not.toBeNull()
      expect(range?.startBook).toBe('gen')
      expect(range?.startChapter).toBe(1)
      expect(range?.endBook).toBe('gen')
      expect(range?.endChapter).toBe(9)
    })
  })

  describe('isLastChapterInTongdok', () => {
    it('마지막 장이 아닐 때 false', () => {
      store.getState().setSchedules(mockSchedules)
      expect(store.getState().isLastChapterInTongdok('gen', 1)).toBe(false)
    })

    it('마지막 장일 때 true', () => {
      store.getState().setSchedules(mockSchedules)
      expect(store.getState().isLastChapterInTongdok('gen', 9)).toBe(true)
    })

    it('스케줄 없을 때 false', () => {
      expect(store.getState().isLastChapterInTongdok('gen', 9)).toBe(false)
    })
  })

  describe('getTongdokProgress', () => {
    it('스케줄 없을 때 0/0 반환', () => {
      const progress = store.getState().getTongdokProgress()
      expect(progress.completed).toBe(0)
      expect(progress.total).toBe(0)
    })

    it('진행률 계산 정확', () => {
      store.getState().setSchedules(mockSchedules)
      store.getState().setProgressList(mockProgressList)
      const progress = store.getState().getTongdokProgress()
      // s1 완료: 3장, s2 미완료: 3장, s3 미완료: 3장 → total=9, completed=3
      expect(progress.total).toBe(9)
      expect(progress.completed).toBe(3)
    })
  })

  describe('isScheduleCompleted', () => {
    it('scheduleId 없을 때 false', () => {
      expect(store.getState().isScheduleCompleted()).toBe(false)
    })

    it('완료된 스케줄이면 true', () => {
      store.getState().enableTongdokMode('s1', 'plan-1')
      store.getState().setProgressList(mockProgressList)
      expect(store.getState().isScheduleCompleted()).toBe(true)
    })

    it('미완료 스케줄이면 false', () => {
      store.getState().enableTongdokMode('s2', 'plan-1')
      store.getState().setProgressList(mockProgressList)
      expect(store.getState().isScheduleCompleted()).toBe(false)
    })
  })

  describe('getAudioLink / getGuideLink', () => {
    const schedulesWithLinks: TongdokSchedule[] = [
      {
        id: 's1',
        plan_id: 1,
        book: 'gen',
        start_chapter: 1,
        end_chapter: 3,
        audio_link: 'https://audio.example.com/gen1',
        guide_link: 'https://guide.example.com/gen1',
      },
    ]

    it('해당 장의 오디오 링크 반환', () => {
      store.getState().setSchedules(schedulesWithLinks)
      expect(store.getState().getAudioLink('gen', 2)).toBe('https://audio.example.com/gen1')
    })

    it('해당 장의 가이드 링크 반환', () => {
      store.getState().setSchedules(schedulesWithLinks)
      expect(store.getState().getGuideLink('gen', 1)).toBe('https://guide.example.com/gen1')
    })

    it('해당 장 없으면 null 반환', () => {
      store.getState().setSchedules(schedulesWithLinks)
      expect(store.getState().getAudioLink('mat', 1)).toBeNull()
    })
  })

  describe('getNextScheduleSuggestion', () => {
    it('scheduleId 없을 때 null 반환', () => {
      store.getState().setSchedules(mockSchedules)
      expect(store.getState().getNextScheduleSuggestion()).toBeNull()
    })

    it('다음 미완료 스케줄 반환', () => {
      store.getState().enableTongdokMode('s1', 'plan-1')
      store.getState().setSchedules(mockSchedules)
      store.getState().setProgressList(mockProgressList)
      const next = store.getState().getNextScheduleSuggestion()
      // s1은 현재 스케줄, s2는 미완료 → s2 반환
      expect(next?.id).toBe('s2')
      expect(next?.book).toBe('gen')
      expect(next?.chapter).toBe(4)
    })
  })

  describe('tongdokModeSelectors', () => {
    it('scheduleRange selector', () => {
      const state = {
        schedules: mockSchedules,
        progressList: [],
        tongdokMode: false,
        scheduleId: null,
        planId: null,
      } as unknown as TongdokModeState
      const range = tongdokModeSelectors.scheduleRange(state)
      expect(range?.startBook).toBe('gen')
      expect(range?.endChapter).toBe(9)
    })

    it('progress selector', () => {
      const state = {
        schedules: mockSchedules,
        progressList: mockProgressList,
        tongdokMode: false,
        scheduleId: null,
        planId: null,
      } as unknown as TongdokModeState
      const progress = tongdokModeSelectors.progress(state)
      expect(progress.total).toBe(9)
      expect(progress.completed).toBe(3)
    })
  })
})
