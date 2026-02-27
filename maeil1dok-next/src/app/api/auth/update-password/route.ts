import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { AuthError } from '@/repositories/types/errors'

function isPasswordValid(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      newPassword?: string
      action?: string
    }

    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    if (body.action === 'resend-verification') {
      if (!user.email) {
        return NextResponse.json({ error: '이메일 정보가 없습니다' }, { status: 400 })
      }

      await repositories.auth.resetPasswordForEmail(user.email)
      return NextResponse.json({ success: true })
    }

    if (!body.newPassword || !isPasswordValid(body.newPassword)) {
      return NextResponse.json(
        { error: '비밀번호는 8자 이상이며 영문과 숫자를 모두 포함해야 합니다' },
        { status: 400 }
      )
    }

    await repositories.auth.updatePassword(body.newPassword)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: '비밀번호 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
