import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/repositories/factory', () => ({
  createServerRepositories: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { PATCH } from '@/app/api/profile/reading-settings/route'

function createRequest(body?: unknown): Request {
  return new Request('http://localhost/api/profile/reading-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function createMalformedJsonRequest(): Request {
  return new Request('http://localhost/api/profile/reading-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{"theme":',
  })
}

describe('PATCH /api/profile/reading-settings — validation before Supabase update', () => {
  const getUser = vi.fn()
  const updateReadingSettings = vi.fn()

  function setUser(user: { id: string } | null) {
    getUser.mockResolvedValue(user)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(createServerRepositories).mockReturnValue({
      auth: { getUser },
      profile: { updateReadingSettings },
    } as never)
    setUser({ id: 'user-1' })
  })

  it('accepts a valid mutable payload and forwards only mutable fields', async () => {
    const result = { id: 's1', theme: 'dark' }
    updateReadingSettings.mockResolvedValue(result)

    const res = await PATCH(
      createRequest({ theme: 'dark', fontSize: 18, verseJoining: true })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(result)
    expect(updateReadingSettings).toHaveBeenCalledTimes(1)
    expect(updateReadingSettings).toHaveBeenCalledWith({
      theme: 'dark',
      fontSize: 18,
      verseJoining: true,
    })
  })

  it.each([
    ['fontSize=14', { fontSize: 14 }],
    ['fontSize=24', { fontSize: 24 }],
    ['lineHeight=1.4', { lineHeight: 1.4 }],
    ['lineHeight=2.4', { lineHeight: 2.4 }],
  ])('accepts boundary %s', async (_label, payload) => {
    updateReadingSettings.mockResolvedValue({ ok: true })

    const res = await PATCH(createRequest(payload))

    expect(res.status).toBe(200)
    expect(updateReadingSettings).toHaveBeenCalledWith(payload)
  })

  it.each([
    ['invalid theme', { theme: 'sepia' }],
    ['invalid fontFamily', { fontFamily: 'comic-sans' }],
    ['fontSize below range', { fontSize: 13 }],
    ['fontSize above range', { fontSize: 25 }],
    ['non-integer fontSize', { fontSize: 18.5 }],
    ['invalid fontWeight', { fontWeight: 'heavy' }],
    ['lineHeight below range', { lineHeight: 1.3 }],
    ['lineHeight above range', { lineHeight: 2.5 }],
    ['invalid textAlign', { textAlign: 'center' }],
    ['non-boolean flag', { verseJoining: 'yes' }],
    ['unknown field', { fooBar: true }],
    ['snake_case field', { font_size: 18 }],
    ['empty object', {}],
    ['read-only-only payload', { id: 'x', userId: 'u', createdAt: 'c', updatedAt: 'up' }],
  ])('rejects %s with 400 and no repository call', async (_label, payload) => {
    const res = await PATCH(createRequest(payload))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid reading settings')
    expect(updateReadingSettings).not.toHaveBeenCalled()
  })

  it.each([
    ['non-object JSON (number)', 42],
    ['non-object JSON (string)', 'nope'],
    ['null JSON', null],
    ['array JSON', [{ theme: 'dark' }]],
  ])('rejects %s with 400 and no repository call', async (_label, payload) => {
    const res = await PATCH(createRequest(payload))

    expect(res.status).toBe(400)
    expect(updateReadingSettings).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON with 400 and no repository call', async () => {
    const res = await PATCH(createMalformedJsonRequest())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid reading settings')
    expect(updateReadingSettings).not.toHaveBeenCalled()
  })

  it('strips read-only fields when a mutable field is present', async () => {
    updateReadingSettings.mockResolvedValue({ ok: true })

    const res = await PATCH(
      createRequest({
        theme: 'light',
        id: 'settings-1',
        userId: 'user-1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      })
    )

    expect(res.status).toBe(200)
    expect(updateReadingSettings).toHaveBeenCalledWith({ theme: 'light' })
  })

  it('returns 401 before parsing body or updating when unauthenticated', async () => {
    setUser(null)

    const res = await PATCH(createMalformedJsonRequest())
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
    expect(updateReadingSettings).not.toHaveBeenCalled()
  })

  it('maps repository failure to 500 { error: "Failed to update" }', async () => {
    updateReadingSettings.mockRejectedValue(new Error('db down'))

    const res = await PATCH(createRequest({ theme: 'dark' }))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Failed to update')
  })

  it('returns the repository result unchanged for a valid update', async () => {
    const repoResult = {
      id: 's1',
      userId: 'user-1',
      theme: 'system',
      fontSize: 20,
    }
    updateReadingSettings.mockResolvedValue(repoResult)

    const res = await PATCH(createRequest({ theme: 'system', fontSize: 20 }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(repoResult)
  })
})
