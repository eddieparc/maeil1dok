import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { notifyFollowersOfCompletion } from '@/lib/notifications/friendActivity'
import { parseJsonBody } from '@/lib/api/parseJsonBody'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDateOnlyString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

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

    const { date, completed } = body

    if (!isDateOnlyString(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    if (typeof completed !== 'boolean') {
      return NextResponse.json({ error: 'completed must be boolean' }, { status: 400 })
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
