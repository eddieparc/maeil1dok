import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 2097152 // 2MB

function getMimeTypeExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  return mimeToExt[mimeType] || 'jpg'
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    // Validate file exists
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, and WebP images are allowed' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 2MB' },
        { status: 400 }
      )
    }

    // Get file extension
    const ext = getMimeTypeExtension(file.type)

    // Upload path
    const path = `avatars/${user.id}/${Date.now()}.${ext}`

    // Convert File to ArrayBuffer
    const buffer = await file.arrayBuffer()

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(uploadData.path)
    const publicUrl = publicUrlData.publicUrl

    // Update profile
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', user.id)

    return NextResponse.json({ avatarUrl: publicUrl })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current avatar_url from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    // Delete file from storage if it exists
    if (profile?.avatar_url) {
      // Extract path from public URL
      // URL format: https://[project].supabase.co/storage/v1/object/public/avatars/[path]
      const urlParts = profile.avatar_url.split('/storage/v1/object/public/avatars/')
      if (urlParts.length === 2) {
        const storagePath = urlParts[1]
        await supabase.storage.from('avatars').remove([storagePath])
      }
    }

    // Set avatar_url to null
    await supabase.from('profiles').update({ avatar_url: null }).eq('user_id', user.id)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete avatar' },
      { status: 500 }
    )
  }
}
