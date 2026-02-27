import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { notifyFollowersOfCompletion } from '@/lib/notifications/friendActivity'

interface CompleteRequestBody {
  date?: string
  completed?: boolean
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CompleteRequestBody
    const date = body.date
    const completed = body.completed

    if (!date || typeof completed !== 'boolean') {
      return NextResponse.json({ error: 'date and completed are required' }, { status: 400 })
    }

    const repositories = createServerRepositories(supabase)
    const record = completed
      ? await repositories.hasena.markHasenaComplete(date)
      : await repositories.hasena.markHasenaIncomplete(date)

    // Fire-and-forget friend activity notification (only when completing, not uncompleting)
    if (completed) {
      void notifyFollowersOfCompletion(user.id, 'hasena')
    }

    return NextResponse.json({
      date: record.date,
      isCompleted: record.isCompleted,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to update hasena completion' }, { status: 500 })
  }
}
