import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { AuthError } from '@/repositories/types/errors'

export async function POST(request: Request) {
  try {
    const { identityId } = await request.json() as { identityId?: string }

    if (!identityId) {
      return NextResponse.json({ error: 'identityId가 필요합니다' }, { status: 400 })
    }

    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    await repositories.auth.unlinkIdentity(identityId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: '연결 해제 중 오류가 발생했습니다' }, { status: 500 })
  }
}
