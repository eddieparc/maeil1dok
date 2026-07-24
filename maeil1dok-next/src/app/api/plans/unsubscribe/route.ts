import { createClient } from '@/lib/supabase/server'
import { parseJsonBody } from '@/lib/api/parseJsonBody'
import { createServerRepositories } from '@/repositories/factory'
import { NextResponse } from 'next/server'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUuidString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
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

    if (!('subscriptionId' in body)) {
      return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 })
    }

    const { subscriptionId } = body
    if (!isUuidString(subscriptionId)) {
      return NextResponse.json({ error: 'subscriptionId must be a UUID' }, { status: 400 })
    }

    const repositories = createServerRepositories(supabase)
    await repositories.plan.unsubscribeFromPlan(subscriptionId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
  }
}
