import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMulticastNotification } from '@/lib/firebase/send'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    // Get current UTC hour to match user reminder times
    const now = new Date()
    const currentHour = now.getUTCHours()
    const currentMinute = now.getUTCMinutes()

    // Query users with daily reminder enabled and push enabled
    const { data: settingsRows, error } = await supabase
      .from('notification_settings')
      .select('user_id, daily_reminder_time')
      .eq('daily_reminder_enabled', true)
      .eq('push_enabled', true)

    if (error) {
      return NextResponse.json({ status: 'error', message: error.message })
    }

    if (!settingsRows || settingsRows.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No users to notify' })
    }

    // Filter users whose reminder time matches current hour (±15 min window)
    const targetUserIds = settingsRows
      .filter((row) => {
        const [h, m] = (row.daily_reminder_time as string).split(':').map(Number)
        const reminderMinutes = h * 60 + m
        const currentMinutes = currentHour * 60 + currentMinute
        return Math.abs(reminderMinutes - currentMinutes) <= 15
      })
      .map((row) => row.user_id as string)

    if (targetUserIds.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No users in current time window' })
    }

    // Get FCM tokens for target users
    const { data: tokenRows, error: tokenError } = await supabase
      .from('fcm_tokens')
      .select('user_id, token')
      .in('user_id', targetUserIds)

    if (tokenError) {
      return NextResponse.json({ status: 'error', message: tokenError.message })
    }

    const tokens = (tokenRows ?? []).map((row) => row.token as string)

    if (tokens.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No FCM tokens found' })
    }

    const result = await sendMulticastNotification(
      tokens,
      '매일일독',
      '오늘의 성경 본문을 읽어보세요!',
      { url: '/bible' }
    )

    // Clean up stale tokens
    if (result.staleTokens.length > 0) {
      await supabase.from('fcm_tokens').delete().in('token', result.staleTokens)
    }

    return NextResponse.json({
      sent: result.successCount,
      failed: result.failureCount,
      staleTokensCleaned: result.staleTokens.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    // Always return 200 to prevent Vercel cron retries
    return NextResponse.json({ status: 'error', message })
  }
}
