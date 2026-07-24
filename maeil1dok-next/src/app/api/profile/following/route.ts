import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { NotFoundError } from '@/repositories/types/errors'
import { NextResponse } from 'next/server'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function parseBoundedInteger(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value.trim() === '') return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback

  return Math.min(Math.max(parsed, min), max)
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || user.id
    const limit = parseBoundedInteger(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
    const offset = parseBoundedInteger(searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)

    const repositories = createServerRepositories(supabase)
    const following = await repositories.profile.getFollowing(userId, limit, offset)

    return NextResponse.json(following)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 })
  }
}
