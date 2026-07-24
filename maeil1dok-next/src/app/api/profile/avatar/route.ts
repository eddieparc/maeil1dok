import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 2097152 // 2MB

const AVATAR_PUBLIC_URL_DELIMITER = '/storage/v1/object/public/avatars/'

/**
 * Extract the Supabase Storage object path from a stored avatar public URL,
 * but only when that path is owned by the authenticated user.
 *
 * Returns the storage path for owned shapes:
 *   - legacy/test shape:   `${userId}/<object...>`
 *   - current upload shape: `avatars/${userId}/<object...>`
 *
 * Returns `null` (skip storage removal) for any non-storage, malformed,
 * foreign-namespace, empty, repeated-delimiter, or traversal-like value so
 * DELETE never issues storage.remove() outside the caller's own namespace.
 */
function extractOwnedAvatarStoragePath(
  avatarUrl: string,
  userId: string
): string | null {
  const parts = avatarUrl.split(AVATAR_PUBLIC_URL_DELIMITER)
  // Delimiter must appear exactly once (absent or repeated => not a trusted URL).
  if (parts.length !== 2) {
    return null
  }

  const storagePath = parts[1]
  if (!storagePath) {
    return null
  }

  const segments = storagePath.split('/')

  // Reject empty / dot / dot-dot segments, both raw and percent-decoded.
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      return null
    }
    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      return null
    }
    if (decoded === '.' || decoded === '..') {
      return null
    }
  }

  // Resolve the owned namespace prefix, then require an object segment after it.
  let objectSegments: string[] | null = null
  if (segments[0] === userId) {
    objectSegments = segments.slice(1)
  } else if (segments[0] === 'avatars' && segments[1] === userId) {
    objectSegments = segments.slice(2)
  } else {
    return null
  }

  if (objectSegments.length < 1) {
    return null
  }

  return storagePath
}

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

    // Update profile (fail closed: an ignored update could persist a stale avatar)
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('user_id', user.id)

    if (profileUpdateError) {
      // Best-effort cleanup of the just-uploaded object; never surface raw storage errors
      await supabase.storage
        .from('avatars')
        .remove([uploadData.path])
        .catch(() => undefined)
      return NextResponse.json(
        { error: 'Failed to update profile avatar' },
        { status: 500 }
      )
    }

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

    // Delete the storage object only when it lives in this user's own namespace.
    // Foreign, malformed, non-storage, or traversal-like URLs skip removal but
    // still get cleared from the profile below.
    if (profile?.avatar_url) {
      const storagePath = extractOwnedAvatarStoragePath(
        profile.avatar_url,
        user.id
      )
      if (storagePath) {
        // Fail closed: an ignored removal error could leave the file orphaned
        const { error: removeError } = await supabase.storage
          .from('avatars')
          .remove([storagePath])
        if (removeError) {
          return NextResponse.json(
            { error: 'Failed to delete avatar file' },
            { status: 500 }
          )
        }
      }
    }

    // Set avatar_url to null (fail closed: an ignored update could keep a stale avatar)
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('user_id', user.id)

    if (profileUpdateError) {
      return NextResponse.json(
        { error: 'Failed to update profile avatar' },
        { status: 500 }
      )
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete avatar' },
      { status: 500 }
    )
  }
}
