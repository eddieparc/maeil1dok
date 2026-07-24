import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { POST as tokenPost, DELETE as tokenDelete } from '@/app/api/notifications/token/route'
import { GET as settingsGet, PATCH as settingsPatch } from '@/app/api/notifications/settings/route'

function createMockSupabase(userOverride?: { id: string } | null) {
  const user = userOverride === null ? null : (userOverride ?? { id: 'user-1' })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn(),
  }
}

function createRequest(method: string, body?: object): Request {
  return new Request('http://localhost/api/test', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function createRawRequest(method: string, rawBody: string | undefined): Request {
  return new Request('http://localhost/api/test', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

describe('Notification API routes', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
  })

  // ---------- POST /api/notifications/token ----------
  describe('POST /api/notifications/token', () => {
    it('returns 200 on valid token upsert', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })

      const req = createRequest('POST', { token: 'fcm-token-abc', deviceInfo: 'Chrome' })
      const res = await tokenPost(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('fcm_tokens')
    })

    it('returns 401 when not authenticated', async () => {
      mockSupabase = createMockSupabase(null)
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const req = createRequest('POST', { token: 'fcm-token-abc' })
      const res = await tokenPost(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 400 when token is missing', async () => {
      const req = createRequest('POST', {})
      const res = await tokenPost(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Token required')
    })

    it('sanitizes raw Supabase upsert errors on database failure', async () => {
      const sentinel = 'duplicate key value violates unique constraint "fcm_tokens_pkey"'
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: sentinel } }),
      })

      const req = createRequest('POST', { token: 'fcm-token-abc' })
      const res = await tokenPost(req)
      const raw = await res.text()
      const json = JSON.parse(raw)

      expect(res.status).toBe(500)
      expect(json.error).toBe('Failed to save notification token')
      expect(raw).not.toContain(sentinel)
    })

    it('returns 400 on malformed JSON without touching the database', async () => {
      const req = createRawRequest('POST', '{ not json')
      const res = await tokenPost(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid request body')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('returns 400 on non-object JSON without touching the database', async () => {
      const req = createRawRequest('POST', '"fcm-token-abc"')
      const res = await tokenPost(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid request body')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('returns 400 on array JSON body without touching the database', async () => {
      const req = createRawRequest('POST', '["fcm-token-abc"]')
      const res = await tokenPost(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid request body')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('returns 400 on null JSON body without touching the database', async () => {
      const req = createRawRequest('POST', 'null')
      const res = await tokenPost(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid request body')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it.each([
      ['array', { token: ['fcm-token-abc'] }],
      ['object', { token: { value: 'fcm-token-abc' } }],
      ['number', { token: 123 }],
      ['boolean', { token: true }],
    ])('returns 400 for non-string token (%s) without upsert', async (_label, body) => {
      const req = createRequest('POST', body)
      const res = await tokenPost(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Token required')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('returns 400 for whitespace-only token without upsert', async () => {
      const req = createRequest('POST', { token: '   ' })
      const res = await tokenPost(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Token required')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('trims surrounding whitespace before upsert', async () => {
      const upsert = vi.fn().mockResolvedValue({ error: null })
      mockSupabase.from.mockReturnValue({ upsert })

      const req = createRequest('POST', { token: '  fcm-token-abc  ' })
      const res = await tokenPost(req)

      expect(res.status).toBe(200)
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'fcm-token-abc' }),
        expect.anything()
      )
    })

    it('returns 401 before parsing a malformed body', async () => {
      mockSupabase = createMockSupabase(null)
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const req = createRawRequest('POST', '{ not json')
      const res = await tokenPost(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  // ---------- DELETE /api/notifications/token ----------
  describe('DELETE /api/notifications/token', () => {
    it('returns 204 when deleting specific token', async () => {
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({}),
          }),
        }),
      })

      const req = createRequest('DELETE', { token: 'fcm-token-abc' })
      const res = await tokenDelete(req)

      expect(res.status).toBe(204)
    })

    it('returns 204 when deleting all tokens (no token in body)', async () => {
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({}),
        }),
      })

      const req = createRequest('DELETE', {})
      const res = await tokenDelete(req)

      expect(res.status).toBe(204)
    })

    it('returns 401 when not authenticated', async () => {
      mockSupabase = createMockSupabase(null)
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const req = createRequest('DELETE', { token: 'fcm-token-abc' })
      const res = await tokenDelete(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 204 and deletes all tokens on an empty body', async () => {
      const eq = vi.fn().mockResolvedValue({})
      const del = vi.fn().mockReturnValue({ eq })
      mockSupabase.from.mockReturnValue({ delete: del })

      const req = createRawRequest('DELETE', undefined)
      const res = await tokenDelete(req)

      expect(res.status).toBe(204)
      expect(mockSupabase.from).toHaveBeenCalledWith('fcm_tokens')
      expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
    })

    it('treats a whitespace-only body like an empty body', async () => {
      const eq = vi.fn().mockResolvedValue({})
      const del = vi.fn().mockReturnValue({ eq })
      mockSupabase.from.mockReturnValue({ delete: del })

      const req = createRawRequest('DELETE', '   \n  ')
      const res = await tokenDelete(req)

      expect(res.status).toBe(204)
      expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
    })

    it('returns 400 on malformed JSON without touching the database', async () => {
      const req = createRawRequest('DELETE', '{ not json')
      const res = await tokenDelete(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid request body')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('returns 400 on non-object JSON without touching the database', async () => {
      const req = createRawRequest('DELETE', '"fcm-token-abc"')
      const res = await tokenDelete(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid request body')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('returns 400 on a non-string token without touching the database', async () => {
      const req = createRequest('DELETE', { token: 123 })
      const res = await tokenDelete(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Token required')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('returns 400 on a whitespace-only token without touching the database', async () => {
      const req = createRequest('DELETE', { token: '   ' })
      const res = await tokenDelete(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Token required')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('sanitizes raw Supabase errors when the all-token delete fails', async () => {
      const sentinel = 'permission denied for table fcm_tokens (role app_user)'
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: sentinel } }),
        }),
      })

      const req = createRequest('DELETE', {})
      const res = await tokenDelete(req)
      const raw = await res.text()
      const json = JSON.parse(raw)

      expect(res.status).toBe(500)
      expect(json.error).toBe('Failed to delete notification token')
      expect(raw).not.toContain(sentinel)
    })

    it('sanitizes raw Supabase errors when the single-token delete fails', async () => {
      const sentinel = 'permission denied for table fcm_tokens (role app_user)'
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: sentinel } }),
          }),
        }),
      })

      const req = createRequest('DELETE', { token: 'fcm-token-abc' })
      const res = await tokenDelete(req)
      const raw = await res.text()
      const json = JSON.parse(raw)

      expect(res.status).toBe(500)
      expect(json.error).toBe('Failed to delete notification token')
      expect(raw).not.toContain(sentinel)
    })

    it('returns 401 before parsing a malformed body', async () => {
      mockSupabase = createMockSupabase(null)
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const req = createRawRequest('DELETE', '{ not json')
      const res = await tokenDelete(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  // ---------- GET /api/notifications/settings ----------
  describe('GET /api/notifications/settings', () => {
    it('returns existing settings', async () => {
      const settingsData = {
        user_id: 'user-1',
        daily_reminder_enabled: true,
        daily_reminder_time: '08:00',
      }
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: settingsData, error: null }),
          }),
        }),
      })

      const res = await settingsGet()
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json).toEqual(settingsData)
    })

    it('creates default settings when none exist', async () => {
      const createdData = { user_id: 'user-1', daily_reminder_enabled: false }
      let callIndex = 0
      mockSupabase.from.mockImplementation(() => {
        callIndex++
        if (callIndex === 1) {
          // First call: select existing → null
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }
        }
        // Second call: insert defaults
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: createdData, error: null }),
            }),
          }),
        }
      })

      const res = await settingsGet()
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json).toEqual(createdData)
    })

    it('returns 500 without inserting when the initial lookup errors', async () => {
      const insert = vi.fn()
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'RLS denied' } }),
          }),
        }),
        insert,
      })

      const res = await settingsGet()
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(json).toEqual({ error: 'Failed to load notification settings' })
      expect(insert).not.toHaveBeenCalled()
      expect(mockSupabase.from).toHaveBeenCalledTimes(1)
    })

    it('sanitizes raw Supabase errors when the default-row insert fails', async () => {
      const sentinel = 'null value in column "user_id" violates not-null constraint'
      let callIndex = 0
      mockSupabase.from.mockImplementation(() => {
        callIndex++
        if (callIndex === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }
        }
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: sentinel } }),
            }),
          }),
        }
      })

      const res = await settingsGet()
      const raw = await res.text()
      const json = JSON.parse(raw)

      expect(res.status).toBe(500)
      expect(json).toEqual({ error: 'Failed to load notification settings' })
      expect(raw).not.toContain(sentinel)
    })

    it('returns 401 when not authenticated', async () => {
      mockSupabase = createMockSupabase(null)
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const res = await settingsGet()
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })
  })

  // ---------- PATCH /api/notifications/settings ----------
  describe('PATCH /api/notifications/settings', () => {
    it('returns 200 with updated settings', async () => {
      const updatedData = {
        user_id: 'user-1',
        daily_reminder_enabled: true,
        daily_reminder_time: '09:00',
      }
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedData, error: null }),
          }),
        }),
      })

      const req = createRequest('PATCH', {
        daily_reminder_enabled: true,
        daily_reminder_time: '09:00',
      })
      const res = await settingsPatch(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json).toEqual(updatedData)
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_settings')
    })

    it('rejects owner fields before updating settings', async () => {
      const upsert = vi.fn()
      mockSupabase.from.mockReturnValue({ upsert })

      const req = createRequest('PATCH', {
        user_id: 'victim-user',
        daily_reminder_enabled: true,
      })
      const res = await settingsPatch(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid notification settings')
      expect(upsert).not.toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
      mockSupabase = createMockSupabase(null)
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const req = createRequest('PATCH', { daily_reminder_enabled: true })
      const res = await settingsPatch(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('sanitizes raw Supabase errors on upsert database failure', async () => {
      const sentinel = 'deadlock detected on relation notification_settings'
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: sentinel } }),
          }),
        }),
      })

      const req = createRequest('PATCH', { daily_reminder_enabled: true })
      const res = await settingsPatch(req)
      const raw = await res.text()
      const json = JSON.parse(raw)

      expect(res.status).toBe(500)
      expect(json.error).toBe('Failed to update notification settings')
      expect(raw).not.toContain(sentinel)
    })

    it('returns 400 on malformed JSON without touching the database', async () => {
      const req = createRawRequest('PATCH', '{ not json')
      const res = await settingsPatch(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid notification settings')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('returns 400 on empty body without touching the database', async () => {
      const req = createRawRequest('PATCH', undefined)
      const res = await settingsPatch(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid notification settings')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('returns 401 for unauthenticated malformed PATCH before parsing', async () => {
      mockSupabase = createMockSupabase(null)
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const req = createRawRequest('PATCH', '{ not json')
      const res = await settingsPatch(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })
})
