import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { targetUserId } = await request.json()

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })
    }

    const repositories = createServerRepositories(supabase)
    await repositories.profile.unfollowUser(targetUserId)

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to unfollow user'

    // Check for not following (404)
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      return NextResponse.json({ error: 'Not following this user' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 })
  }
}
