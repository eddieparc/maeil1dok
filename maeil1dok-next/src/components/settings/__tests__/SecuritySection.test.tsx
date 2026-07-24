import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SecuritySection from '../SecuritySection'
import type { User, UserIdentity } from '@/types'

function buildUser(hasPassword: boolean): User {
  return {
    id: 'user-1',
    email: 'viewer@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    userMetadata: hasPassword ? { has_password: true } : {},
  }
}

const identities: UserIdentity[] = []

function lastFetchBody(): unknown {
  const fetchMock = vi.mocked(fetch)
  const init = fetchMock.mock.calls[0]?.[1]
  return JSON.parse(String(init?.body))
}

describe('SecuritySection — password change current-password proof', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends currentPassword proof for a password-backed user', async () => {
    render(<SecuritySection user={buildUser(true)} identities={identities} />)

    await userEvent.type(screen.getByLabelText('현재 비밀번호'), 'old-pass-123')
    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'abcd1234')
    await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'abcd1234')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/update-password')
    expect(lastFetchBody()).toEqual({
      newPassword: 'abcd1234',
      currentPassword: 'old-pass-123',
    })
  })

  it('does not call fetch when a password-backed user leaves currentPassword blank', async () => {
    render(<SecuritySection user={buildUser(true)} identities={identities} />)

    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'abcd1234')
    await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'abcd1234')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    expect(screen.getByText('현재 비밀번호를 입력해 주세요')).toBeInTheDocument()
  })

  it('omits currentPassword for a non-password-backed first-password setup', async () => {
    render(<SecuritySection user={buildUser(false)} identities={identities} />)

    expect(screen.queryByLabelText('현재 비밀번호')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'abcd1234')
    await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'abcd1234')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(lastFetchBody()).toEqual({ newPassword: 'abcd1234' })
  })
})
