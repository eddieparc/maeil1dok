import { getFirebaseAdmin } from './admin'

const FCM_MULTICAST_TOKEN_LIMIT = 500

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const messaging = getFirebaseAdmin()
    await messaging.send({
      token,
      notification: { title, body },
      data,
      webpush: {
        notification: { title, body, icon: '/icon-192x192.png' },
        fcmOptions: { link: data?.url ?? '/' },
      },
    })
    return { success: true }
  } catch (error) {
    const errorCode = (error as { code?: string }).code
    return { success: false, error: errorCode ?? 'unknown' }
  }
}

export async function sendMulticastNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ successCount: number; failureCount: number; staleTokens: string[] }> {
  if (tokens.length === 0) return { successCount: 0, failureCount: 0, staleTokens: [] }

  const messaging = getFirebaseAdmin()

  let successCount = 0
  let failureCount = 0
  const staleTokens: string[] = []

  for (let start = 0; start < tokens.length; start += FCM_MULTICAST_TOKEN_LIMIT) {
    const chunk = tokens.slice(start, start + FCM_MULTICAST_TOKEN_LIMIT)
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      data,
      webpush: {
        notification: { title, body, icon: '/icon-192x192.png' },
        fcmOptions: { link: data?.url ?? '/' },
      },
    })

    successCount += response.successCount
    failureCount += response.failureCount

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          staleTokens.push(chunk[idx])
        }
      }
    })
  }

  return {
    successCount,
    failureCount,
    staleTokens,
  }
}
