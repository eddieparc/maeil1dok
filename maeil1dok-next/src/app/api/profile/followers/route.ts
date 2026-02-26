import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || user.id
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0

    const repositories = createServerRepositories(supabase)
    const followers = await repositories.profile.getFollowers(userId, limit, offset)

    return NextResponse.json(followers)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch followers'
    return NextResponse.json({ error: 'Failed to fetch followers' }, { status: 500 })
  }
}
