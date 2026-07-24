import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { cronAuthError } from '@/lib/cron/auth'

function serviceUnavailable(code: string) {
  return NextResponse.json({ status: 'error', code }, { status: 503 })
}

export async function GET(request: NextRequest) {
  const authError = cronAuthError(request)
  if (authError) return authError

  try {
    // No hasena on Sundays (day 0)
    const today = new Date()
    if (today.getDay() === 0) {
      return NextResponse.json({ status: 'skipped', reason: 'sunday' })
    }

    const supabase = createServiceRoleClient()

    const todayStr = today.toISOString().split('T')[0]

    // Validate required env vars
    const geminiApiKey = process.env.GEMINI_API_KEY
    const playlistId = process.env.HASENA_PLAYLIST_ID
    const youtubeApiKey = process.env.YOUTUBE_API_KEY

    if (!geminiApiKey || !playlistId || !youtubeApiKey) {
      return serviceUnavailable('configuration_unavailable')
    }

    // Idempotency: check if already generated today
    const { data: existing, error: existingError } = await supabase
      .from('hasena_summaries')
      .select('id')
      .gte('created_at', todayStr)
      .limit(1)

    if (existingError) {
      return serviceUnavailable('data_access_unavailable')
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({ status: 'skipped', reason: 'already_generated' })
    }

    // 1. Fetch latest playlist video from YouTube Data API
    const ytUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=1&playlistId=${playlistId}&key=${youtubeApiKey}`
    const ytResponse = await fetch(ytUrl)

    if (!ytResponse.ok) {
      return serviceUnavailable('upstream_unavailable')
    }

    const ytData = (await ytResponse.json()) as {
      items?: Array<{
        snippet: {
          resourceId: { videoId: string }
          title: string
        }
      }>
    }

    if (!ytData.items || ytData.items.length === 0) {
      return serviceUnavailable('upstream_unavailable')
    }

    const videoId = ytData.items[0].snippet.resourceId.videoId
    const title = ytData.items[0].snippet.title

    // 2. Check if this video was already processed (idempotency by video_id)
    const { data: existingVideo, error: existingVideoError } = await supabase
      .from('hasena_summaries')
      .select('id')
      .eq('video_id', videoId)
      .limit(1)

    if (existingVideoError) {
      return serviceUnavailable('data_access_unavailable')
    }

    if (existingVideo && existingVideo.length > 0) {
      return NextResponse.json({ status: 'skipped', reason: 'video_already_processed' })
    }

    // 3. Generate summary with Gemini
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `다음 하세나하시조 영상 제목을 바탕으로 성경 묵상 요약을 한국어로 작성해주세요. 영상 제목: ${title}\n\n다음 3가지 섹션으로 구성해주세요:\n1. 오늘의 본문: 오늘 읽을 성경 본문 구절\n2. 교역자 해설: 본문에 대한 간략한 해설 (2-3문장)\n3. 오늘의 하시조: 오늘의 묵상 포인트 (1-2문장)`

    let summary: string
    try {
      const result = await model.generateContent(prompt)
      summary = result.response.text()
    } catch {
      return serviceUnavailable('generation_unavailable')
    }

    // 4. Store in hasena_summaries
    const { error: insertError } = await supabase
      .from('hasena_summaries')
      .insert({
        video_id: videoId,
        video_date: todayStr,
        title,
        summary,
        transcript: '',
        model_used: 'gemini-1.5-flash',
      } as never)

    if (insertError) {
      return serviceUnavailable('data_access_unavailable')
    }

    // Trigger hasena notifications (fire-and-forget)
    void (async () => {
      try {
        const { data: settingsData } = await supabase
          .from('notification_settings')
          .select('user_id')
          .eq('hasena_notification_enabled', true)
          .eq('push_enabled', true)

        // The generated Database type omits per-table Relationships, so typed
        // selects widen to `never`; cast to the known projected shape locally.
        const settings = (settingsData ?? []) as Array<{ user_id: string }>

        if (settings.length > 0) {
          const userIds = settings.map((s) => s.user_id)
          const { data: tokenData } = await supabase
            .from('fcm_tokens')
            .select('token')
            .in('user_id', userIds)

          const tokenRows = (tokenData ?? []) as Array<{ token: string }>

          if (tokenRows.length > 0) {
            const { sendMulticastNotification } = await import('@/lib/firebase/send')
            const tokens = tokenRows.map((r) => r.token)
            const result = await sendMulticastNotification(
              tokens,
              '하세나하시조',
              '오늘의 하세나하시조 영상이 도착했습니다!',
              { url: '/hasena' }
            )

            // Clean up stale tokens
            if (result.staleTokens.length > 0) {
              await supabase.from('fcm_tokens').delete().in('token', result.staleTokens)
            }
          }
        }
      } catch (e) {
        console.error('[hasena-summary] Failed to send notifications:', e)
      }
    })()

    return NextResponse.json({
      status: 'generated',
      videoId,
      title,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Supabase service credentials are not configured'
    ) {
      return serviceUnavailable('configuration_unavailable')
    }
    return serviceUnavailable('internal_error')
  }
}
