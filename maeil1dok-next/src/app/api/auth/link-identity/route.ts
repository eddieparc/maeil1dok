import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PROVIDERS = ['kakao', 'google', 'apple'] as const
type OAuthProvider = (typeof PROVIDERS)[number]

export async function POST(request: Request) {
  try {
    const { provider } = await request.json() as { provider?: OAuthProvider }

    if (!provider || !PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: '유효하지 않은 OAuth 제공자입니다' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const origin = new URL(request.url).origin
    const redirectTo = `${origin}/auth/callback?next=/settings`
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo },
    })

    if (error || !data?.url) {
      return NextResponse.json({ error: error?.message ?? '연결 요청에 실패했습니다' }, { status: 400 })
    }

    return NextResponse.json({ url: data.url })
  } catch {
    return NextResponse.json({ error: '연결 요청 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
