import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // No hasena on Sundays (day 0)
  const today = new Date()
  if (today.getDay() === 0) {
    return NextResponse.json({ status: 'skipped', reason: 'sunday' })
  }

  const supabase = await createClient()
  const todayStr = today.toISOString().split('T')[0]

  // Check if already generated today
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
  if (!geminiApiKey || !playlistId) {
    return NextResponse.json(
      { error: 'Missing required environment variables' },
      { status: 500 }
    )
  }

  // Initialize Gemini (used after YouTube fetch is implemented)
  const _genAI = new GoogleGenerativeAI(geminiApiKey)

  // TODO: Fetch latest playlist video from YouTube Data API using playlistId
  // TODO: Get video transcript/captions
  // TODO: Generate summary with Gemini
  // TODO: Insert into hasena_summaries

  return NextResponse.json({
    status: 'ready',
    message: 'Ready to generate - YouTube playlist fetch not yet implemented',
    playlistId,
  })
}
