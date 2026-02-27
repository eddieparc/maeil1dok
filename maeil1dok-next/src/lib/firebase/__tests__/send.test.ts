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
  })
})
