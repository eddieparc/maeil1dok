import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // No hasena on Sundays (day 0)
    const today = new Date()
    if (today.getDay() === 0) {
      return NextResponse.json({ status: 'skipped', reason: 'sunday' })
    }

    const supabase = await createClient()
    const todayStr = today.toISOString().split('T')[0]

    // Idempotency: check if already generated today
    const { data: existing } = await supabase
      .from('hasena_summaries')
      .select('id')
      .gte('created_at', todayStr)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ status: 'skipped', reason: 'already_generated' })
    }

    // Validate required env vars
    const geminiApiKey = process.env.GEMINI_API_KEY
    const playlistId = process.env.HASENA_PLAYLIST_ID
    const youtubeApiKey = process.env.YOUTUBE_API_KEY

    if (!geminiApiKey || !playlistId) {
      return NextResponse.json({
        status: 'error',
        message: 'Missing required environment variables',
      })
    }

    if (!youtubeApiKey) {
      return NextResponse.json({
        status: 'error',
        message: 'Missing YOUTUBE_API_KEY',
      })
    }

    // 1. Fetch latest playlist video from YouTube Data API
    const ytUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=1&playlistId=${playlistId}&key=${youtubeApiKey}`
    const ytResponse = await fetch(ytUrl)

    if (!ytResponse.ok) {
      return NextResponse.json({
        status: 'error',
        message: `YouTube API error: ${ytResponse.status}`,
      })
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
      return NextResponse.json({
        status: 'error',
        message: 'No videos found in playlist',
      })
    }

    const videoId = ytData.items[0].snippet.resourceId.videoId
    const title = ytData.items[0].snippet.title

    // 2. Check if this video was already processed (idempotency by video_id)
    const { data: existingVideo } = await supabase
      .from('hasena_summaries')
      .select('id')
      .eq('video_id', videoId)
      .limit(1)

    if (existingVideo && existingVideo.length > 0) {
      return NextResponse.json({ status: 'skipped', reason: 'video_already_processed' })
    }

    // 3. Generate summary with Gemini
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `다음 하세나하시조 영상 제목을 바탕으로 성경 묵상 요약을 한국어로 작성해주세요. 영상 제목: ${title}\n\n다음 3가지 섹션으로 구성해주세요:\n1. 오늘의 본문: 오늘 읽을 성경 본문 구절\n2. 교역자 해설: 본문에 대한 간략한 해설 (2-3문장)\n3. 오늘의 하시조: 오늘의 묵상 포인트 (1-2문장)`

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

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
      })

    if (insertError) {
      return NextResponse.json({
        status: 'error',
        message: `Failed to store summary: ${insertError.message}`,
      })
    }

    return NextResponse.json({
      status: 'generated',
      videoId,
      title,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    // Always return 200 to prevent Vercel cron retries
    return NextResponse.json({
      status: 'error',
      message,
    })
  }
}
