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

    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
    }

    const repositories = createServerRepositories(supabase)
    await repositories.profile.followUser(targetUserId)

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to follow user'
    
    // Check for duplicate follow (409 Conflict)
    if (errorMessage.includes('duplicate') || errorMessage.includes('already')) {
      return NextResponse.json({ error: 'Already following this user' }, { status: 409 })
    }

    // Check for user not found (404)
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 })
  }
}
