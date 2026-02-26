import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { nickname, bio } = await request.json()

    // Validation
    if (!nickname || !nickname.trim()) {
      return NextResponse.json(
        { error: '닉네임은 필수입니다' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)

    // Update profile using repository
    const updatedProfile = await repositories.profile.updateProfile({
      nickname: nickname.trim(),
      bio: bio?.trim() || '',
    })

    return NextResponse.json(updatedProfile)
  } catch (error) {
    return NextResponse.json(
      { error: '프로필 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
