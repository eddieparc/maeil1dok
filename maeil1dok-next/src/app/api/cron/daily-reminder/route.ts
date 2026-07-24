import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendMulticastNotification } from '@/lib/firebase/send'
import { cronAuthError } from '@/lib/cron/auth'

const MISSING_CREDENTIALS_MESSAGE = 'Supabase service credentials are not configured'

/**
 * Build an alertable HTTP 503 response with a sanitized public message.
 *
 * Never include Supabase URLs, service-role keys, FCM tokens, user IDs, or raw
 * secrets in the returned message — cron monitoring reads these responses.
 */
function serviceUnavailable(message: string) {
  return NextResponse.json({ status: 'error', message }, { status: 503 })
}

export async function GET(request: NextRequest) {
  const authError = cronAuthError(request)
  if (authError) return authError

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch {
    return serviceUnavailable(MISSING_CREDENTIALS_MESSAGE)
  }

  try {
    // Get current UTC hour to match user reminder times
    const now = new Date()
    const currentHour = now.getUTCHours()
    const currentMinute = now.getUTCMinutes()

    // Query users with daily reminder enabled and push enabled
    const { data: settingsData, error } = await supabase
      .from('notification_settings')
      .select('user_id, daily_reminder_time')
      .eq('daily_reminder_enabled', true)
      .eq('push_enabled', true)

    if (error) {
      return serviceUnavailable('Failed to read notification settings')
    }

    // The generated Database type omits per-table Relationships, so typed
    // selects widen to `never`; cast to the known projected shape locally.
    const settingsRows = (settingsData ?? []) as Array<{
      user_id: string
      daily_reminder_time: string
    }>

    if (settingsRows.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No users to notify' })
    }

    // Filter users whose reminder time matches current hour (±15 min window)
    const targetUserIds = settingsRows
      .filter((row) => {
        const [h, m] = row.daily_reminder_time.split(':').map(Number)
        const reminderMinutes = h * 60 + m
        const currentMinutes = currentHour * 60 + currentMinute
        return Math.abs(reminderMinutes - currentMinutes) <= 15
      })
      .map((row) => row.user_id)

    if (targetUserIds.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No users in current time window' })
    }

    // Get FCM tokens for target users
    const { data: tokenData, error: tokenError } = await supabase
      .from('fcm_tokens')
      .select('user_id, token')
      .in('user_id', targetUserIds)

    if (tokenError) {
      return serviceUnavailable('Failed to read FCM tokens')
    }

    const tokenRows = (tokenData ?? []) as Array<{ user_id: string; token: string }>
    const tokens = tokenRows.map((row) => row.token)

    if (tokens.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No FCM tokens found' })
    }

    const result = await sendMulticastNotification(
      tokens,
      '매일일독',
      '오늘의 성경 본문을 읽어보세요!',
      { url: '/bible' }
    )

    const staleFailureCount = result.staleTokens.length
    const nonStaleFailureCount = Math.max(0, result.failureCount - staleFailureCount)

    // Clean up stale tokens before returning any final response.
    if (staleFailureCount > 0) {
      await supabase.from('fcm_tokens').delete().in('token', result.staleTokens)
    }

    // Alert when every attempted delivery failed for reasons other than
    // stale-token cleanup: no successes and at least one non-stale failure.
    if (result.successCount === 0 && nonStaleFailureCount > 0) {
      return serviceUnavailable('Daily reminder delivery failed')
    }

    return NextResponse.json({
      sent: result.successCount,
      failed: result.failureCount,
      staleTokensCleaned: staleFailureCount,
    })
  } catch {
    // Authorized cron failures must surface to monitoring as 503, not a
    // misleading HTTP 200 no-op. Do not leak the underlying error details.
    return serviceUnavailable('Daily reminder cron failed')
  }
}
