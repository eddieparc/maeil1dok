import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/firebase/admin', () => ({
  getFirebaseAdmin: vi.fn(),
}))

import { sendPushNotification, sendMulticastNotification } from '@/lib/firebase/send'
import { getFirebaseAdmin } from '@/lib/firebase/admin'

const mockMessaging = {
  send: vi.fn(),
  sendEachForMulticast: vi.fn(),
}

describe('Firebase send helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getFirebaseAdmin).mockReturnValue(mockMessaging as any)
  })

  describe('sendPushNotification', () => {
    it('returns success on successful send', async () => {
      mockMessaging.send.mockResolvedValue('message-id-123')

      const result = await sendPushNotification('token-1', 'Title', 'Body')

      expect(result).toEqual({ success: true })
      expect(mockMessaging.send).toHaveBeenCalledWith({
        token: 'token-1',
        notification: { title: 'Title', body: 'Body' },
        data: undefined,
        webpush: {
          notification: { title: 'Title', body: 'Body', icon: '/icon-192x192.png' },
          fcmOptions: { link: '/' },
        },
      })
    })

    it('returns failure with error code on invalid token', async () => {
      mockMessaging.send.mockRejectedValue({
        code: 'messaging/registration-token-not-registered',
      })

      const result = await sendPushNotification('bad-token', 'Title', 'Body')

      expect(result).toEqual({
        success: false,
        error: 'messaging/registration-token-not-registered',
      })
    })

    it('returns unknown error when error has no code', async () => {
      mockMessaging.send.mockRejectedValue(new Error('network error'))

      const result = await sendPushNotification('token-1', 'Title', 'Body')

      expect(result).toEqual({ success: false, error: 'unknown' })
    })

    it('passes data and uses data.url for fcmOptions link', async () => {
      mockMessaging.send.mockResolvedValue('msg-id')

      await sendPushNotification('token-1', 'Title', 'Body', { url: '/reading' })

      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { url: '/reading' },
          webpush: expect.objectContaining({
            fcmOptions: { link: '/reading' },
          }),
        })
      )
    })
  })

  describe('sendMulticastNotification', () => {
    it('returns zeros for empty tokens array', async () => {
      const result = await sendMulticastNotification([], 'Title', 'Body')

      expect(result).toEqual({ successCount: 0, failureCount: 0, staleTokens: [] })
      expect(mockMessaging.sendEachForMulticast).not.toHaveBeenCalled()
    })

    it('returns correct counts on full success', async () => {
      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [
          { success: true },
          { success: true },
        ],
      })

      const result = await sendMulticastNotification(
        ['token-1', 'token-2'], 'Title', 'Body'
      )

      expect(result).toEqual({ successCount: 2, failureCount: 0, staleTokens: [] })
    })

    it('detects stale tokens from registration-token-not-registered', async () => {
      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          {
            success: false,
            error: { code: 'messaging/registration-token-not-registered' },
          },
        ],
      })

      const result = await sendMulticastNotification(
        ['good-token', 'stale-token'], 'Title', 'Body'
      )

      expect(result.staleTokens).toEqual(['stale-token'])
      expect(result.successCount).toBe(1)
      expect(result.failureCount).toBe(1)
    })

    it('detects stale tokens from invalid-registration-token', async () => {
      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 0,
        failureCount: 1,
        responses: [
          {
            success: false,
            error: { code: 'messaging/invalid-registration-token' },
          },
        ],
      })

      const result = await sendMulticastNotification(['bad-token'], 'Title', 'Body')

      expect(result.staleTokens).toEqual(['bad-token'])
    })

    it('does not mark non-stale errors as stale tokens', async () => {
      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 0,
        failureCount: 1,
        responses: [
          {
            success: false,
            error: { code: 'messaging/internal-error' },
          },
        ],
      })

      const result = await sendMulticastNotification(['token-1'], 'Title', 'Body')

      expect(result.staleTokens).toEqual([])
      expect(result.failureCount).toBe(1)
    })

    const buildSuccessResponse = (count: number) => ({
      successCount: count,
      failureCount: 0,
      responses: Array.from({ length: count }, () => ({ success: true })),
    })

    it('sends exactly one Firebase call for 500 tokens', async () => {
      mockMessaging.sendEachForMulticast.mockResolvedValue(buildSuccessResponse(500))
      const tokens = Array.from({ length: 500 }, (_, i) => `token-${i}`)

      await sendMulticastNotification(tokens, 'Title', 'Body')

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledTimes(1)
      expect(mockMessaging.sendEachForMulticast.mock.calls[0][0].tokens).toHaveLength(500)
    })

    it('sends two chunks of [500, 1] for 501 tokens', async () => {
      mockMessaging.sendEachForMulticast
        .mockResolvedValueOnce(buildSuccessResponse(500))
        .mockResolvedValueOnce(buildSuccessResponse(1))
      const tokens = Array.from({ length: 501 }, (_, i) => `token-${i}`)

      await sendMulticastNotification(tokens, 'Title', 'Body')

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledTimes(2)
      expect(mockMessaging.sendEachForMulticast.mock.calls[0][0].tokens).toHaveLength(500)
      expect(mockMessaging.sendEachForMulticast.mock.calls[1][0].tokens).toHaveLength(1)
    })

    it('sends three chunks of [500, 500, 201] for 1201 tokens', async () => {
      mockMessaging.sendEachForMulticast
        .mockResolvedValueOnce(buildSuccessResponse(500))
        .mockResolvedValueOnce(buildSuccessResponse(500))
        .mockResolvedValueOnce(buildSuccessResponse(201))
      const tokens = Array.from({ length: 1201 }, (_, i) => `token-${i}`)

      await sendMulticastNotification(tokens, 'Title', 'Body')

      const calls = mockMessaging.sendEachForMulticast.mock.calls
      expect(calls).toHaveLength(3)
      expect(calls.map((c: any[]) => c[0].tokens.length)).toEqual([500, 500, 201])
      // chunks preserve original token ordering and content
      expect(calls[0][0].tokens[0]).toBe('token-0')
      expect(calls[1][0].tokens[0]).toBe('token-500')
      expect(calls[2][0].tokens[200]).toBe('token-1200')
    })

    it('aggregates success and failure counts across chunks', async () => {
      mockMessaging.sendEachForMulticast
        .mockResolvedValueOnce({
          successCount: 499,
          failureCount: 1,
          responses: [
            ...Array.from({ length: 499 }, () => ({ success: true })),
            { success: false, error: { code: 'messaging/internal-error' } },
          ],
        })
        .mockResolvedValueOnce({
          successCount: 1,
          failureCount: 0,
          responses: [{ success: true }],
        })
      const tokens = Array.from({ length: 501 }, (_, i) => `token-${i}`)

      const result = await sendMulticastNotification(tokens, 'Title', 'Body')

      expect(result.successCount).toBe(500)
      expect(result.failureCount).toBe(1)
      expect(result.staleTokens).toEqual([])
    })

    it('returns stale tokens from later chunks using correct original token values', async () => {
      mockMessaging.sendEachForMulticast
        .mockResolvedValueOnce(buildSuccessResponse(500))
        .mockResolvedValueOnce({
          successCount: 0,
          failureCount: 1,
          responses: [
            { success: false, error: { code: 'messaging/registration-token-not-registered' } },
          ],
        })
      const tokens = Array.from({ length: 501 }, (_, i) => `token-${i}`)

      const result = await sendMulticastNotification(tokens, 'Title', 'Body')

      expect(result.staleTokens).toEqual(['token-500'])
    })
  })
})
