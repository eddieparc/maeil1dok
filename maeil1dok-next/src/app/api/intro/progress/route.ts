import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { videoIntroId, completed } = body as { videoIntroId: string; completed: boolean }

    if (!videoIntroId || typeof completed !== 'boolean') {
      return NextResponse.json(
        { error: 'videoIntroId (string) and completed (boolean) are required' },
        { status: 400 }
      )
    }

    // Verify the video intro exists
    const { data: videoIntro, error: introError } = await supabase
      .from('video_bible_intros')
      .select('id')
      .eq('id', videoIntroId)
      .single()

    if (introError || !videoIntro) {
      return NextResponse.json({ error: 'Video intro not found' }, { status: 404 })
    }

    // Upsert progress
    const { data, error } = await (supabase
      .from('user_video_intro_progress') as any)
      .upsert(
        {
          user_id: user.id,
          video_intro_id: videoIntroId,
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
        },
        { onConflict: 'user_id,video_intro_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        id: data.id,
        userId: data.user_id,
        videoIntroId: data.video_intro_id,
        isCompleted: data.is_completed,
        completedAt: data.completed_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
