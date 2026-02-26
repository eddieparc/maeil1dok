import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { planId, startDate } = await request.json()
    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)
    const subscription = await repositories.plan.subscribeToPlan(planId, startDate)
    return NextResponse.json(subscription)
  } catch {
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }
}
