import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyFollowersOfCompletion } from '@/lib/notifications/friendActivity'

interface FriendActivityRequestBody {
  activityType?: 'reading' | 'hasena'
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as FriendActivityRequestBody
    const { activityType } = body

    if (!activityType || !['reading', 'hasena'].includes(activityType)) {
      return NextResponse.json(
        { error: 'activityType must be "reading" or "hasena"' },
        { status: 400 }
      )
    }

    // Fire-and-forget — respond immediately, send notifications in background
    void notifyFollowersOfCompletion(user.id, activityType)

    return NextResponse.json({ status: 'queued' })
  } catch {
    return NextResponse.json({ error: 'Failed to queue notification' }, { status: 500 })
  }
}
