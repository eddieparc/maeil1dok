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

    if (!('sessionId' in body)) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const { sessionId } = body

    if (!isUuidString(sessionId)) {
      return NextResponse.json({ error: 'sessionId must be a UUID' }, { status: 400 })
    }

    const repositories = createServerRepositories(supabase)
    const session = await repositories.catchup.getSessionById(sessionId)

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Terminal sessions (completed/abandoned) are immutable: reject re-abandon.
    if (session.status !== 'active') {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const updated = await repositories.catchup.updateSessionStatus(sessionId, 'abandoned')
    return NextResponse.json({ session: updated })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to abandon catchup session' }, { status: 500 })
  }
}
