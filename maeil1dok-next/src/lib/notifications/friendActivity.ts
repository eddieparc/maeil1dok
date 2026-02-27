import { createClient } from '@/lib/supabase/server'
import { sendMulticastNotification } from '@/lib/firebase/send'

export async function notifyFollowersOfCompletion(
  userId: string,
  activityType: 'reading' | 'hasena'
): Promise<void> {
  // Fire-and-forget — wrap in try/catch, never throw
  try {
    const supabase = await createClient()

    // Get user's nickname
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('user_id', userId)
      .single()

    const nickname = profile?.nickname ?? '친구'
    const activityLabel = activityType === 'reading' ? '성경 읽기' : '하세나 영상'

    // Get followers of this user
    const { data: follows } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('following_id', userId)

    if (!follows || follows.length === 0) return

    const followerIds = follows.map((f) => f.follower_id)

    // Filter followers with friend_activity_enabled + push_enabled
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('user_id')
      .in('user_id', followerIds)
      .eq('friend_activity_enabled', true)
      .eq('push_enabled', true)

    if (!settings || settings.length === 0) return

    const targetUserIds = settings.map((s) => s.user_id)

    // Get FCM tokens for target users (excluding the user themselves)
    const { data: tokenRows } = await supabase
      .from('fcm_tokens')
      .select('token')
      .in('user_id', targetUserIds)
      .neq('user_id', userId) // Don't notify yourself

    if (!tokenRows || tokenRows.length === 0) return

    const tokens = tokenRows.map((r) => r.token)

    const result = await sendMulticastNotification(
      tokens,
      '친구 활동',
      `${nickname}님이 오늘 ${activityLabel}을 완료했습니다!`,
      { url: `/profile/${userId}` }
    )

    // Clean up stale tokens
    if (result.staleTokens.length > 0) {
      await supabase.from('fcm_tokens').delete().in('token', result.staleTokens)
    }
  } catch (error) {
    // Fire-and-forget: log but never throw
    console.error('[friendActivity] Failed to send notifications:', error)
  }
}
