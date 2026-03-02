// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTongdokMode } from '../useTongdokMode'

const STORAGE_KEY = 'tongdokModeState'

describe('useTongdokMode', () => {
  const storage = new Map<string, string>()

  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
    clear: () => {
      storage.clear()
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    storage.clear()
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    })
    global.fetch = vi.fn()
  })

  it('enables/disables mode and persists to localStorage', () => {
    const { result } = renderHook(() => useTongdokMode())

    act(() => {
      result.current.enableTongdokMode('schedule-1', '7')
    })

    expect(result.current.tongdokMode).toBe(true)
    expect(result.current.tongdokScheduleId).toBe('schedule-1')
    expect(result.current.tongdokPlanId).toBe('7')

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    expect(saved.enabled).toBe(true)
    expect(saved.scheduleId).toBe('schedule-1')
    expect(saved.planId).toBe('7')

    act(() => {
      result.current.disableTongdokMode()
    })

    expect(result.current.tongdokMode).toBe(false)
    expect(result.current.tongdokScheduleId).toBeNull()
    expect(result.current.tongdokPlanId).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('restores persisted tongdok state from localStorage on mount', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        enabled: true,
        scheduleId: 'schedule-from-storage',
        planId: '42',
        updatedAt: '2026-03-02T00:00:00.000Z',
      })
    )

    const { result } = renderHook(() => useTongdokMode())

    expect(result.current.tongdokMode).toBe(true)
    expect(result.current.tongdokScheduleId).toBe('schedule-from-storage')
    expect(result.current.tongdokPlanId).toBe('42')
  })

  it('computes schedule range and last chapter status', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'schedule-1',
              plan_id: 7,
              date: '2026-03-02',
              book: 'gen',
              start_chapter: 1,
              end_chapter: 2,
              audio_link: null,
              guide_link: null,
            },
            {
              id: 'schedule-2',
              plan_id: 7,
              date: '2026-03-02',
              book: 'exo',
              start_chapter: 1,
              end_chapter: 1,
              audio_link: null,
              guide_link: null,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'schedule-1', plan_id: 7, date: '2026-03-02', is_completed: false },
            { id: 'schedule-2', plan_id: 7, date: '2026-03-02', is_completed: false },
          ],
        }),
      })

    const { result } = renderHook(() => useTongdokMode())

    act(() => {
      result.current.enableTongdokMode('schedule-1', '7')
    })

    await act(async () => {
      await result.current.loadReadingDetail('7')
    })

    expect(result.current.getTongdokScheduleRange()).toEqual({
      startBook: 'gen',
      startChapter: 1,
      endBook: 'exo',
      endChapter: 1,
    })
    expect(result.current.isLastChapterInTongdok('gen', 2)).toBe(false)
    expect(result.current.isLastChapterInTongdok('exo', 1)).toBe(true)
  })

  it('calls complete API and clears mode state on success', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'schedule-1',
              plan_id: 7,
              date: '2026-03-02',
              book: 'gen',
              start_chapter: 1,
              end_chapter: 1,
              audio_link: 'audio-url',
              guide_link: 'guide-url',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'schedule-1',
              plan_id: 7,
              date: '2026-03-02',
              is_completed: false,
              subscription_id: 'sub-1',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { success: true } }),
      })

    const { result } = renderHook(() => useTongdokMode())

    act(() => {
      result.current.enableTongdokMode('schedule-1', '7')
    })

    await act(async () => {
      await result.current.loadReadingDetail('7')
    })

    let completed = false
    await act(async () => {
      completed = await result.current.completeReading()
    })

    expect(completed).toBe(true)
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/bible/schedules/complete',
      expect.objectContaining({
        method: 'POST',
      })
    )

    const completeCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[2]
    const body = JSON.parse(completeCall[1].body as string)
    expect(body).toEqual({ schedule_id: 'schedule-1', subscription_id: 'sub-1' })

    expect(result.current.tongdokMode).toBe(false)
    expect(result.current.tongdokScheduleId).toBeNull()
    expect(result.current.tongdokPlanId).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('returns tongdok progress as completed and total chapters', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'schedule-1',
              plan_id: 7,
              date: '2026-03-02',
              book: 'gen',
              start_chapter: 1,
              end_chapter: 2,
              audio_link: null,
              guide_link: null,
            },
            {
              id: 'schedule-2',
              plan_id: 7,
              date: '2026-03-02',
              book: 'exo',
              start_chapter: 1,
              end_chapter: 3,
              audio_link: null,
              guide_link: null,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'schedule-1', plan_id: 7, date: '2026-03-02', is_completed: true },
            { id: 'schedule-2', plan_id: 7, date: '2026-03-02', is_completed: false },
          ],
        }),
      })

    const { result } = renderHook(() => useTongdokMode())

    act(() => {
      result.current.enableTongdokMode('schedule-1', '7')
    })

    await act(async () => {
      await result.current.loadReadingDetail('7')
    })

    expect(result.current.getTongdokProgress()).toEqual({ completed: 2, total: 5 })
    expect(result.current.isScheduleCompleted()).toBe(true)
  })
})
