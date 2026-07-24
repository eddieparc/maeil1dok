import { createClient } from '@/lib/supabase/server'
import { parseJsonBody } from '@/lib/api/parseJsonBody'
import { NextResponse } from 'next/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUuidString(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = await parseJsonBody<unknown>(request)
    if (!parsed.ok) {
      return parsed.response
    }

    const body = parsed.body
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }

    const { videoIntroId, completed } = body
    if (!isUuidString(videoIntroId)) {
      return NextResponse.json({ error: 'videoIntroId must be a UUID string' }, { status: 400 })
    }
    if (typeof completed !== 'boolean') {
      return NextResponse.json({ error: 'completed must be boolean' }, { status: 400 })
    }

    // Authorize: the intro must belong to an active plan the user actively
    // subscribes to. Deny-by-default with the same 404 shape for every failure.
    const authorized = await isIntroAuthorized(supabase, user.id, videoIntroId)
    if (!authorized) {
      return NextResponse.json({ error: 'Video intro not found' }, { status: 404 })
    }

    // Upsert progress
    const { data, error } = await supabase
      .from('user_video_intro_progress')
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

// Returns true only when the intro exists, its plan is active, and the user has
// an active subscription to that plan. Any query error is treated as unauthorized.
async function isIntroAuthorized(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  videoIntroId: string,
): Promise<boolean> {
  const { data: intro, error: introError } = await supabase
    .from('video_bible_intros')
    .select('id, plan_id')
    .eq('id', videoIntroId)
    .maybeSingle()
  if (introError || !intro) return false

  const { data: plan, error: planError } = await supabase
    .from('bible_reading_plans')
    .select('id')
    .eq('id', intro.plan_id)
    .eq('is_active', true)
    .maybeSingle()
  if (planError || !plan) return false

  const { data: subscription, error: subscriptionError } = await supabase
    .from('plan_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_id', intro.plan_id)
    .eq('is_active', true)
    .maybeSingle()
  if (subscriptionError || !subscription) return false

  return true
}
