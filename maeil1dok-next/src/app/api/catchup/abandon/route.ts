import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'

interface AbandonCatchupRequestBody {
  sessionId?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AbandonCatchupRequestBody
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const repositories = createServerRepositories(supabase)
    const session = await repositories.catchup.getSessionById(sessionId)

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const updated = await repositories.catchup.updateSessionStatus(sessionId, 'abandoned')
    return NextResponse.json({ session: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to abandon catchup session' }, { status: 500 })
  }
}
