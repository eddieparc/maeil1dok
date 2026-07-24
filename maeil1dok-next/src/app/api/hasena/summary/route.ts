import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const videoId = request.nextUrl.searchParams.get('videoId')?.trim()
  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  }

  // Check cache first
  const { data: cached, error: queryError } = await supabase
    .from('hasena_summaries')
    .select('id, video_id, video_date, title, summary, transcript, model_used, is_edited, created_at, updated_at')
    .eq('video_id', videoId)
    .maybeSingle()

  if (queryError) {
    return NextResponse.json({ error: 'Failed to load Hasena summary' }, { status: 500 })
  }

  if (!cached) {
    return NextResponse.json({ error: 'Summary not available yet' }, { status: 404 })
  }

  return NextResponse.json(cached)
}
