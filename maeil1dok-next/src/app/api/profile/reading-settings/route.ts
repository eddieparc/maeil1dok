import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const repos = createServerRepositories(supabase)
    const user = await repos.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await repos.profile.getReadingSettings()
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const repos = createServerRepositories(supabase)
    const user = await repos.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updates = await request.json()
    const settings = await repos.profile.updateReadingSettings(updates)
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
