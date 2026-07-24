import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { NotFoundError } from '@/repositories/types/errors'
import { parseJsonBody } from '@/lib/api/parseJsonBody'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUuidString(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isDateOnlyString(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
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

    const parseResult = await parseJsonBody<unknown>(request)

    if (!parseResult.ok) {
      return parseResult.response
    }

    const body = parseResult.body

    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }

    if (!('scheduleId' in body)) {
      return NextResponse.json({ error: 'scheduleId is required' }, { status: 400 })
    }

    const { scheduleId, date } = body

    if (!isUuidString(scheduleId)) {
      return NextResponse.json({ error: 'scheduleId must be a UUID' }, { status: 400 })
    }

    if (!isDateOnlyString(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
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
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: 'Catchup schedule not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to mark catchup schedule complete' }, { status: 500 })
  }
}
