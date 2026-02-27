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

    it('returns 500 on database error', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      })

      const req = createRequest('POST', { token: 'fcm-token-abc' })
      const res = await tokenPost(req)
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(json.error).toBe('DB error')
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
  })

  // ---------- GET /api/notifications/settings ----------
  describe('GET /api/notifications/settings', () => {
    it('returns existing settings', async () => {
      const settingsData = {
        user_id: 'user-1',
        daily_reminder: true,
        reminder_time: '08:00',
      }
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: settingsData }),
          }),
        }),
      })

      const res = await settingsGet()
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json).toEqual(settingsData)
    })

    it('creates default settings when none exist', async () => {
      const createdData = { user_id: 'user-1', daily_reminder: false }
      let callIndex = 0
      mockSupabase.from.mockImplementation(() => {
        callIndex++
        if (callIndex === 1) {
          // First call: select existing → null
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null }),
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
        daily_reminder: true,
        reminder_time: '09:00',
      }
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedData, error: null }),
          }),
        }),
      })

      const req = createRequest('PATCH', { daily_reminder: true, reminder_time: '09:00' })
      const res = await settingsPatch(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json).toEqual(updatedData)
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_settings')
    })

    it('returns 401 when not authenticated', async () => {
      mockSupabase = createMockSupabase(null)
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const req = createRequest('PATCH', { daily_reminder: true })
      const res = await settingsPatch(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 500 on database error', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Conflict' } }),
          }),
        }),
      })

      const req = createRequest('PATCH', { daily_reminder: true })
      const res = await settingsPatch(req)
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(json.error).toBe('Conflict')
    })
  })
})
