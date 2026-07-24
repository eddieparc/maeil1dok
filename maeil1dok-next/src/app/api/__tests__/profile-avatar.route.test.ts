// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { POST as avatarPost, DELETE as avatarDelete } from '@/app/api/profile/avatar/route'

const PUBLIC_URL =
  'https://proj.supabase.co/storage/v1/object/public/avatars/user-1/123.jpg'

type SupabaseConfig = {
  user?: { id: string } | null
  authError?: unknown
  uploadResult?: { data: { path: string } | null; error: unknown }
  publicUrl?: string
  profileUpdateResult?: { error: unknown }
  profileSelectResult?: { data: { avatar_url: string | null } | null; error: unknown }
  removeResult?: { error: unknown }
}

function createMockSupabase(config: SupabaseConfig = {}) {
  const {
    user = { id: 'user-1' },
    authError = null,
    uploadResult = { data: { path: 'avatars/user-1/123.jpg' }, error: null },
    publicUrl = PUBLIC_URL,
    profileUpdateResult = { error: null },
    profileSelectResult = { data: { avatar_url: null }, error: null },
    removeResult = { error: null },
  } = config

  const uploadFn = vi.fn().mockResolvedValue(uploadResult)
  const getPublicUrlFn = vi.fn(() => ({ data: { publicUrl } }))
  const removeFn = vi.fn().mockResolvedValue(removeResult)

  const updateEqFn = vi.fn().mockResolvedValue(profileUpdateResult)
  const updateFn = vi.fn(() => ({ eq: updateEqFn }))
  const singleFn = vi.fn().mockResolvedValue(profileSelectResult)
  const selectEqFn = vi.fn(() => ({ single: singleFn }))
  const selectFn = vi.fn(() => ({ eq: selectEqFn }))

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: uploadFn,
        getPublicUrl: getPublicUrlFn,
        remove: removeFn,
      })),
    },
    from: vi.fn(() => ({ update: updateFn, select: selectFn })),
  }

  return {
    supabase,
    spies: { uploadFn, getPublicUrlFn, removeFn, updateFn, updateEqFn, selectFn, singleFn },
  }
}

function createFile(type: string, size = 1024): File {
  return new File([new Uint8Array(size)], 'avatar', { type })
}

function createFormRequest(file: File | null): Request {
  const form = new FormData()
  if (file) {
    form.append('file', file)
  }
  return new Request('http://localhost/api/profile/avatar', {
    method: 'POST',
    body: form,
  })
}

function createDeleteRequest(): Request {
  return new Request('http://localhost/api/profile/avatar', { method: 'DELETE' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/profile/avatar', () => {
  it('returns 401 before touching storage or profile when unauthenticated', async () => {
    const { supabase, spies } = createMockSupabase({ user: null })
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarPost(createFormRequest(createFile('image/jpeg')))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
    expect(spies.uploadFn).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns 400 before upload when file is missing', async () => {
    const { supabase, spies } = createMockSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarPost(createFormRequest(null))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('File is required')
    expect(spies.uploadFn).not.toHaveBeenCalled()
  })

  it('returns 400 before upload for a disallowed MIME type', async () => {
    const { supabase, spies } = createMockSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarPost(createFormRequest(createFile('image/gif')))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Only JPEG, PNG, and WebP images are allowed')
    expect(spies.uploadFn).not.toHaveBeenCalled()
  })

  it('returns 400 before upload for a file larger than 2MB', async () => {
    const { supabase, spies } = createMockSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarPost(createFormRequest(createFile('image/jpeg', 2097153)))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('File size must be less than 2MB')
    expect(spies.uploadFn).not.toHaveBeenCalled()
  })

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ])('uploads %s and persists avatar_url, returning { avatarUrl }', async (mime, ext) => {
    const uploadPath = `avatars/user-1/999.${ext}`
    const { supabase, spies } = createMockSupabase({
      uploadResult: { data: { path: uploadPath }, error: null },
    })
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarPost(createFormRequest(createFile(mime)))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ avatarUrl: PUBLIC_URL })
    // Upload path shape: avatars/<user.id>/<timestamp>.<ext>
    const uploadArg = spies.uploadFn.mock.calls[0][0] as string
    expect(uploadArg).toMatch(new RegExp(`^avatars/user-1/\\d+\\.${ext}$`))
    expect(spies.updateFn).toHaveBeenCalledWith({ avatar_url: PUBLIC_URL })
    expect(spies.removeFn).not.toHaveBeenCalled()
  })

  it('returns 500 without profile update when storage upload fails', async () => {
    const { supabase, spies } = createMockSupabase({
      uploadResult: { data: null, error: { message: 'storage down' } },
    })
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarPost(createFormRequest(createFile('image/jpeg')))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Failed to upload file')
    expect(spies.updateFn).not.toHaveBeenCalled()
  })

  it('returns 500 and cleans up the uploaded object when profile update fails', async () => {
    const uploadPath = 'avatars/user-1/555.jpg'
    const { supabase, spies } = createMockSupabase({
      uploadResult: { data: { path: uploadPath }, error: null },
      profileUpdateResult: { error: { message: 'db write failed' } },
    })
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarPost(createFormRequest(createFile('image/jpeg')))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Failed to update profile avatar')
    expect(json.avatarUrl).toBeUndefined()
    // Best-effort cleanup of the just-uploaded object
    expect(spies.removeFn).toHaveBeenCalledWith([uploadPath])
  })
})

describe('DELETE /api/profile/avatar', () => {
  it('returns 401 before profile or storage access when unauthenticated', async () => {
    const { supabase, spies } = createMockSupabase({ user: null })
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarDelete(createDeleteRequest())
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
    expect(supabase.from).not.toHaveBeenCalled()
    expect(spies.removeFn).not.toHaveBeenCalled()
  })

  it('returns 500 when profile lookup fails', async () => {
    const { supabase, spies } = createMockSupabase({
      profileSelectResult: { data: null, error: { message: 'lookup failed' } },
    })
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarDelete(createDeleteRequest())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Failed to fetch profile')
    expect(spies.removeFn).not.toHaveBeenCalled()
    expect(spies.updateFn).not.toHaveBeenCalled()
  })

  it('returns 500 before clearing avatar_url when storage removal fails', async () => {
    const { supabase, spies } = createMockSupabase({
      profileSelectResult: { data: { avatar_url: PUBLIC_URL }, error: null },
      removeResult: { error: { message: 'remove failed' } },
    })
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarDelete(createDeleteRequest())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Failed to delete avatar file')
    expect(spies.removeFn).toHaveBeenCalledWith(['user-1/123.jpg'])
    expect(spies.updateFn).not.toHaveBeenCalled()
  })

  it('returns 500 when clearing profiles.avatar_url fails', async () => {
    const { supabase, spies } = createMockSupabase({
      profileSelectResult: { data: { avatar_url: PUBLIC_URL }, error: null },
      profileUpdateResult: { error: { message: 'null update failed' } },
    })
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarDelete(createDeleteRequest())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Failed to update profile avatar')
    expect(spies.removeFn).toHaveBeenCalledWith(['user-1/123.jpg'])
    expect(spies.updateFn).toHaveBeenCalledWith({ avatar_url: null })
  })

  it('returns 204 after removing the storage object and clearing avatar_url', async () => {
    const { supabase, spies } = createMockSupabase({
      profileSelectResult: { data: { avatar_url: PUBLIC_URL }, error: null },
    })
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarDelete(createDeleteRequest())

    expect(res.status).toBe(204)
    expect(spies.removeFn).toHaveBeenCalledWith(['user-1/123.jpg'])
    expect(spies.updateFn).toHaveBeenCalledWith({ avatar_url: null })
  })

  it('returns 204 without storage removal when there is no current avatar', async () => {
    const { supabase, spies } = createMockSupabase({
      profileSelectResult: { data: { avatar_url: null }, error: null },
    })
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarDelete(createDeleteRequest())

    expect(res.status).toBe(204)
    expect(spies.removeFn).not.toHaveBeenCalled()
    expect(spies.updateFn).toHaveBeenCalledWith({ avatar_url: null })
  })

  it('removes the current upload shape object owned by the user', async () => {
    const { supabase, spies } = createMockSupabase({
      profileSelectResult: {
        data: {
          avatar_url:
            'https://proj.supabase.co/storage/v1/object/public/avatars/avatars/user-1/123.jpg',
        },
        error: null,
      },
    })
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await avatarDelete(createDeleteRequest())

    expect(res.status).toBe(204)
    expect(spies.removeFn).toHaveBeenCalledWith(['avatars/user-1/123.jpg'])
    expect(spies.updateFn).toHaveBeenCalledWith({ avatar_url: null })
  })

  const skippedRemovalCases: Array<{ name: string; avatarUrl: string }> = [
    {
      name: 'foreign legacy-shape path',
      avatarUrl:
        'https://proj.supabase.co/storage/v1/object/public/avatars/victim/123.jpg',
    },
    {
      name: 'foreign current-upload-shape path',
      avatarUrl:
        'https://proj.supabase.co/storage/v1/object/public/avatars/avatars/victim/123.jpg',
    },
    {
      name: 'empty suffix after the delimiter',
      avatarUrl:
        'https://proj.supabase.co/storage/v1/object/public/avatars/',
    },
    {
      name: 'repeated delimiter',
      avatarUrl:
        'https://proj.supabase.co/storage/v1/object/public/avatars//storage/v1/object/public/avatars/user-1/123.jpg',
    },
    {
      name: 'legacy-shape traversal segment',
      avatarUrl:
        'https://proj.supabase.co/storage/v1/object/public/avatars/user-1/../victim.jpg',
    },
    {
      name: 'current-upload-shape traversal segment',
      avatarUrl:
        'https://proj.supabase.co/storage/v1/object/public/avatars/avatars/user-1/../victim.jpg',
    },
    {
      name: 'percent-encoded traversal segment',
      avatarUrl:
        'https://proj.supabase.co/storage/v1/object/public/avatars/user-1/%2e%2e/victim.jpg',
    },
    {
      name: 'owned namespace with no object segment',
      avatarUrl:
        'https://proj.supabase.co/storage/v1/object/public/avatars/user-1/',
    },
    {
      name: 'non-storage url',
      avatarUrl: 'https://cdn.example.com/user-1/123.jpg',
    },
  ]

  it.each(skippedRemovalCases)(
    'clears avatar_url without storage removal for $name',
    async ({ avatarUrl }) => {
      const { supabase, spies } = createMockSupabase({
        profileSelectResult: { data: { avatar_url: avatarUrl }, error: null },
      })
      vi.mocked(createClient).mockResolvedValue(supabase as never)

      const res = await avatarDelete(createDeleteRequest())

      expect(res.status).toBe(204)
      expect(spies.removeFn).not.toHaveBeenCalled()
      expect(spies.updateFn).toHaveBeenCalledWith({ avatar_url: null })
    }
  )
})
