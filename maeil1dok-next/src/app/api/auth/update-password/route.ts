import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJsonBody } from '@/lib/api/parseJsonBody'
import { createServerRepositories } from '@/repositories/factory'
import { AuthError } from '@/repositories/types/errors'

function isPasswordValid(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const PASSWORD_POLICY_ERROR = '비밀번호는 8자 이상이며 영문과 숫자를 모두 포함해야 합니다'
const CURRENT_PASSWORD_REQUIRED_ERROR = '현재 비밀번호를 입력해 주세요'

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function passwordPolicyResponse() {
  return NextResponse.json({ error: PASSWORD_POLICY_ERROR }, { status: 400 })
}

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

    if (!isRecord(body)) {
      return passwordPolicyResponse()
    }

    if (body.action === 'resend-verification') {
      if (!user.email) {
        return NextResponse.json({ error: '이메일 정보가 없습니다' }, { status: 400 })
      }

      const repositories = createServerRepositories(supabase)
      await repositories.auth.resetPasswordForEmail(user.email)
      return NextResponse.json({ success: true })
    }

    const newPassword = body.newPassword

    if (typeof newPassword !== 'string' || !isPasswordValid(newPassword)) {
      return passwordPolicyResponse()
    }

    const requiresCurrentPassword = user.user_metadata?.has_password === true

    if (requiresCurrentPassword && !isNonBlankString(body.currentPassword)) {
      return NextResponse.json({ error: CURRENT_PASSWORD_REQUIRED_ERROR }, { status: 400 })
    }

    const repositories = createServerRepositories(supabase)
    await repositories.auth.updatePassword(
      newPassword,
      requiresCurrentPassword ? (body.currentPassword as string) : undefined
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: '비밀번호 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
