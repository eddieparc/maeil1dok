import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'

interface CompleteCatchupRequestBody {
  scheduleId?: string
  date?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompleteCatchupRequestBody
    const { scheduleId, date } = body

    if (!scheduleId || !date) {
      return NextResponse.json({ error: 'scheduleId and date are required' }, { status: 400 })
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
    const updatedSchedule = await repositories.catchup.markScheduleComplete(scheduleId)
    const sessionSchedules = await repositories.catchup.getSchedulesForSession(updatedSchedule.sessionId)

    let sessionStatus = 'active'
    if (sessionSchedules.length > 0 && sessionSchedules.every((schedule) => schedule.isCompleted)) {
      await repositories.catchup.updateSessionStatus(updatedSchedule.sessionId, 'completed')
      sessionStatus = 'completed'
    }

    return NextResponse.json({
      scheduleId: updatedSchedule.id,
      isCompleted: updatedSchedule.isCompleted,
      sessionId: updatedSchedule.sessionId,
      sessionStatus,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to mark catchup schedule complete' }, { status: 500 })
  }
}
