import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const markComplete = vi.fn()
const markIncomplete = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({})),
}))

vi.mock('@/repositories/factory', () => ({
  createClientRepositories: vi.fn(() => ({
    progress: { markComplete, markIncomplete },
  })),
}))

import ReadingProgressButton from '../ReadingProgressButton'

describe('ReadingProgressButton — friend-activity completion proof', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    markComplete.mockResolvedValue(undefined)
    markIncomplete.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks complete and posts friend-activity with subscription + schedule proof', async () => {
    render(
      <ReadingProgressButton
        scheduleId="schedule-1"
        subscriptionId="sub-1"
        initialCompleted={false}
      />
    )

    await userEvent.click(screen.getByTestId('progress-button'))

    expect(markComplete).toHaveBeenCalledWith('sub-1', 'schedule-1')
    expect(markIncomplete).not.toHaveBeenCalled()

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/notifications/friend-activity')
    expect(JSON.parse(String(init?.body))).toEqual({
      activityType: 'reading',
      subscriptionId: 'sub-1',
      scheduleId: 'schedule-1',
    })
  })

  it('marks incomplete and does NOT post friend-activity when uncompleting', async () => {
    render(
      <ReadingProgressButton
        scheduleId="schedule-1"
        subscriptionId="sub-1"
        initialCompleted={true}
      />
    )

    await userEvent.click(screen.getByTestId('progress-button'))

    expect(markIncomplete).toHaveBeenCalledWith('sub-1', 'schedule-1')
    expect(markComplete).not.toHaveBeenCalled()
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
})
