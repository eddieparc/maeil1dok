import { createClient } from '@/lib/supabase/server'
import { parseJsonBody } from '@/lib/api/parseJsonBody'
import { createServerRepositories } from '@/repositories/factory'
import { AuthError } from '@/repositories/types/errors'
import { NextResponse } from 'next/server'

const BIO_MAX_LENGTH = 500

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parseResult = await parseJsonBody<unknown>(request)
    if (!parseResult.ok) {
      return parseResult.response
    }

    const body = parseResult.body
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }

    const { nickname, bio, isPublic } = body as {
      nickname?: unknown
      bio?: unknown
      isPublic?: unknown
    }

    if (typeof nickname !== 'string' || nickname.trim().length === 0) {
      return NextResponse.json({ error: '닉네임은 필수입니다' }, { status: 400 })
    }

    const updateData: { nickname: string; bio?: string; isPublic?: boolean } = {
      nickname: nickname.trim(),
    }

    if (bio !== undefined) {
      if (typeof bio !== 'string') {
        return NextResponse.json({ error: '자기소개는 문자열이어야 합니다' }, { status: 400 })
      }
      const trimmedBio = bio.trim()
      if (trimmedBio.length > BIO_MAX_LENGTH) {
        return NextResponse.json(
          { error: `자기소개는 ${BIO_MAX_LENGTH}자를 초과할 수 없습니다` },
          { status: 400 }
        )
      }
      updateData.bio = trimmedBio
    }

    if (isPublic !== undefined) {
      if (typeof isPublic !== 'boolean') {
        return NextResponse.json({ error: '공개 여부는 boolean이어야 합니다' }, { status: 400 })
      }
      updateData.isPublic = isPublic
    }

    const repositories = createServerRepositories(supabase)
    const updatedProfile = await repositories.profile.updateProfile(updateData)

    return NextResponse.json(updatedProfile)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: '프로필 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
