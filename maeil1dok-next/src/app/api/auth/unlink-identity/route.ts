import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJsonBody } from '@/lib/api/parseJsonBody'
import { createServerRepositories } from '@/repositories/factory'
import { AuthError } from '@/repositories/types/errors'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const parseResult = await parseJsonBody<unknown>(request)

    if (!parseResult.ok) {
      return parseResult.response
    }

    const body = parseResult.body

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'identityId가 필요합니다' }, { status: 400 })
    }

    const rawIdentityId = (body as { identityId?: unknown }).identityId

    if (typeof rawIdentityId !== 'string' || !rawIdentityId.trim()) {
      return NextResponse.json({ error: 'identityId가 필요합니다' }, { status: 400 })
    }

    const identityId = rawIdentityId.trim()

    const repositories = createServerRepositories(supabase)
    await repositories.auth.unlinkIdentity(identityId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: '연결 해제 중 오류가 발생했습니다' }, { status: 500 })
  }
}
