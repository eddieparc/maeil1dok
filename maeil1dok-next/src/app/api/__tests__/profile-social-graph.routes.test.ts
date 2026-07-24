import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError, ValidationError } from '@/repositories/types/errors'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/repositories/factory', () => ({
  createServerRepositories: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { GET as followersGet } from '@/app/api/profile/followers/route'
import { GET as followingGet } from '@/app/api/profile/following/route'
import { POST as followPost } from '@/app/api/profile/follow/route'
import { POST as unfollowPost } from '@/app/api/profile/unfollow/route'

function createMockSupabase(userOverride?: { id: string } | null) {
  const user = userOverride === null ? null : (userOverride ?? { id: 'viewer-user' })
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  }
}

function createRequest(path: string): Request {
  return new Request(`http://localhost${path}`)
}

function createJsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createRawPostRequest(path: string, body: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

describe('profile social graph API routes', () => {
  const getFollowers = vi.fn()
  const getFollowing = vi.fn()
  const followUser = vi.fn()
  const unfollowUser = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
    vi.mocked(createServerRepositories).mockReturnValue({
      profile: { getFollowers, getFollowing, followUser, unfollowUser },
    } as never)
  })

  it('returns 401 for unauthenticated followers requests before repository access', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

    const res = await followersGet(createRequest('/api/profile/followers'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(getFollowers).not.toHaveBeenCalled()
  })

  it('returns 401 for unauthenticated following requests before repository access', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

    const res = await followingGet(createRequest('/api/profile/following'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(getFollowing).not.toHaveBeenCalled()
  })

  it('returns 401 for unauthenticated follow requests before repository access', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

    const res = await followPost(createJsonRequest('/api/profile/follow', { targetUserId: 'target-user' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(followUser).not.toHaveBeenCalled()
  })

  it('returns 401 for an unauthenticated malformed follow request before parsing its body', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

    const res = await followPost(createRawPostRequest('/api/profile/follow', '{'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(followUser).not.toHaveBeenCalled()
    expect(unfollowUser).not.toHaveBeenCalled()
  })

  it('returns 401 for an unauthenticated malformed unfollow request before parsing its body', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

    const res = await unfollowPost(createRawPostRequest('/api/profile/unfollow', '{'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(followUser).not.toHaveBeenCalled()
    expect(unfollowUser).not.toHaveBeenCalled()
  })

  it.each(['{', ''])('rejects malformed or empty authenticated follow JSON before repository access', async (body) => {
    const res = await followPost(createRawPostRequest('/api/profile/follow', body))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Invalid JSON body' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(followUser).not.toHaveBeenCalled()
    expect(unfollowUser).not.toHaveBeenCalled()
  })

  it.each(['{', ''])('rejects malformed or empty authenticated unfollow JSON before repository access', async (body) => {
    const res = await unfollowPost(createRawPostRequest('/api/profile/unfollow', body))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Invalid JSON body' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(followUser).not.toHaveBeenCalled()
    expect(unfollowUser).not.toHaveBeenCalled()
  })

  it.each([
    null,
    [],
    'target-user',
    true,
    42,
    {},
    { targetUserId: '   ' },
    { targetUserId: {} },
    { targetUserId: false },
    { targetUserId: 42 },
  ])('rejects invalid authenticated follow bodies before repository access', async (body) => {
    const res = await followPost(createJsonRequest('/api/profile/follow', body))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'targetUserId is required' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(followUser).not.toHaveBeenCalled()
    expect(unfollowUser).not.toHaveBeenCalled()
  })

  it.each([
    null,
    [],
    'target-user',
    true,
    42,
    {},
    { targetUserId: '   ' },
    { targetUserId: {} },
    { targetUserId: false },
    { targetUserId: 42 },
  ])('rejects invalid authenticated unfollow bodies before repository access', async (body) => {
    const res = await unfollowPost(createJsonRequest('/api/profile/unfollow', body))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'targetUserId is required' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(followUser).not.toHaveBeenCalled()
    expect(unfollowUser).not.toHaveBeenCalled()
  })

  it('trims a valid follow target before repository access', async () => {
    const res = await followPost(createJsonRequest('/api/profile/follow', { targetUserId: ' target-user ' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(followUser).toHaveBeenCalledWith('target-user')
    expect(unfollowUser).not.toHaveBeenCalled()
  })

  it('trims a valid unfollow target before repository access', async () => {
    const res = await unfollowPost(createJsonRequest('/api/profile/unfollow', { targetUserId: ' target-user ' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(unfollowUser).toHaveBeenCalledWith('target-user')
    expect(followUser).not.toHaveBeenCalled()
  })

  it('maps an Already following ValidationError from followUser to 409', async () => {
    followUser.mockRejectedValue(new ValidationError('Already following'))

    const res = await followPost(createJsonRequest('/api/profile/follow', { targetUserId: 'target-user' }))
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json).toEqual({ error: 'Already following this user' })
  })

  it('maps a Not following this user NotFoundError from unfollowUser to 404', async () => {
    unfollowUser.mockRejectedValue(new NotFoundError('Not following this user'))

    const res = await unfollowPost(createJsonRequest('/api/profile/unfollow', { targetUserId: 'target-user' }))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'Not following this user' })
  })

  it('maps private or missing followers targets to 404', async () => {
    getFollowers.mockRejectedValue(new NotFoundError('Profile not found', 'profiles'))

    const res = await followersGet(createRequest('/api/profile/followers?userId=private-user'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Not found')
  })

  it('maps private or missing following targets to 404', async () => {
    getFollowing.mockRejectedValue(new NotFoundError('Profile not found', 'profiles'))

    const res = await followingGet(createRequest('/api/profile/following?userId=private-user'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Not found')
  })

  it('maps private or missing follow targets to 404 User not found', async () => {
    followUser.mockRejectedValue(new NotFoundError('Profile not found', 'profiles'))

    const res = await followPost(createJsonRequest('/api/profile/follow', { targetUserId: 'private-user' }))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('User not found')
    expect(followUser).toHaveBeenCalledWith('private-user')
  })

  it('passes default pagination and authenticated viewer fallback to followers repository', async () => {
    const rows = [{ id: 'follow-1', followerId: 'a', followingId: 'viewer-user', createdAt: '2026-01-01' }]
    getFollowers.mockResolvedValue(rows)

    const res = await followersGet(createRequest('/api/profile/followers'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(rows)
    expect(getFollowers).toHaveBeenCalledWith('viewer-user', 20, 0)
  })

  it('bounds following pagination before repository access', async () => {
    getFollowing.mockResolvedValue([])

    const res = await followingGet(createRequest('/api/profile/following?userId=target-user&limit=999&offset=-3'))

    expect(res.status).toBe(200)
    expect(getFollowing).toHaveBeenCalledWith('target-user', 100, 0)
  })

  it('defaults malformed followers pagination before repository access', async () => {
    getFollowers.mockResolvedValue([])

    const res = await followersGet(createRequest('/api/profile/followers?limit=NaN&offset=wat'))

    expect(res.status).toBe(200)
    expect(getFollowers).toHaveBeenCalledWith('viewer-user', 20, 0)
  })
})
