import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { subscriptionId } = await request.json()
    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)
    await repositories.plan.unsubscribeFromPlan(subscriptionId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
  }
}
