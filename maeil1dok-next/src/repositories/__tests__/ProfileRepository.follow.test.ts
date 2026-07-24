import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseProfileRepository } from '@/repositories/implementations/SupabaseProfileRepository'
import { NetworkError, NotFoundError } from '@/repositories/types/errors'
import type { UserFollow } from '@/types'

type QueryResult = { data?: unknown; error?: { message: string; code?: string } | null; count?: number }

function createQuery(results: {
  single?: QueryResult
  range?: QueryResult
  in?: QueryResult
  insert?: QueryResult
  deleteCount?: number
} = {}) {
  const query: any = {}
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.order = vi.fn(() => query)
  query.limit = vi.fn(() => query)
  query.update = vi.fn(() => query)
  query.upsert = vi.fn(() => query)
  query.delete = vi.fn(() => query)
  query.insert = vi.fn(() => Promise.resolve(results.insert ?? { error: null }))
  query.single = vi.fn(() => Promise.resolve(results.single ?? { data: null, error: null }))
  query.range = vi.fn(() => Promise.resolve(results.range ?? { data: [], error: null }))
  query.in = vi.fn(() => Promise.resolve(results.in ?? { data: [], error: null }))
  query.delete.mockReturnValue({
    eq: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null, count: results.deleteCount ?? 1 })),
    })),
  })
  return query
}

function createMockSupabase() {
  const mockFrom = vi.fn()
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'current-user' } },
    }),
  }
  const tableQueues = new Map<string, any[]>()
  const chainableQuery = createQuery()

  mockFrom.mockImplementation((table: string) => tableQueues.get(table)?.shift() ?? chainableQuery)

  return {
    from: mockFrom,
    auth: mockAuth,
    chainableQuery,
    enqueue(table: string, query: any) {
      tableQueues.set(table, [...(tableQueues.get(table) ?? []), query])
    },
  }
}

const mockFollowRow = {
  id: 'follow-1',
  follower_id: 'current-user',
  following_id: 'target-user',
  created_at: '2026-01-01T00:00:00.000Z',
}

const expectedFollow: UserFollow = {
  id: 'follow-1',
  followerId: 'current-user',
  followingId: 'target-user',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function enqueueTargetProfile(mockSupabase: ReturnType<typeof createMockSupabase>, isPublic: boolean) {
  mockSupabase.enqueue('profiles', createQuery({
    single: { data: { user_id: 'target-user', is_public: isPublic }, error: null },
  }))
}

function enqueueFollowRows(mockSupabase: ReturnType<typeof createMockSupabase>, rows: typeof mockFollowRow[]) {
  mockSupabase.enqueue('user_follows', createQuery({ range: { data: rows, error: null } }))
}

function enqueueRelatedProfiles(
  mockSupabase: ReturnType<typeof createMockSupabase>,
  rows: Array<{ user_id: string; is_public: boolean }>
) {
  mockSupabase.enqueue('profiles', createQuery({ in: { data: rows, error: null } }))
}

describe('SupabaseProfileRepository — follow methods', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>
  let repo: SupabaseProfileRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    repo = new SupabaseProfileRepository(mockSupabase as never)
  })

  describe('followUser', () => {
    it('inserts follow record for a public target user', async () => {
      const profileQuery = createQuery({
        single: { data: { user_id: 'target-user', is_public: true }, error: null },
      })
      const followQuery = createQuery({ insert: { error: null } })
      mockSupabase.enqueue('profiles', profileQuery)
      mockSupabase.enqueue('user_follows', followQuery)

      await repo.followUser('target-user')

      expect(mockSupabase.from).toHaveBeenNthCalledWith(1, 'profiles')
      expect(profileQuery.select).toHaveBeenCalledWith('user_id, is_public')
      expect(profileQuery.eq).toHaveBeenCalledWith('user_id', 'target-user')
      expect(profileQuery.single).toHaveBeenCalled()
      expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'user_follows')
      expect(followQuery.insert).toHaveBeenCalledWith({
        follower_id: 'current-user',
        following_id: 'target-user',
      })
    })

    it('throws NotFoundError without inserting when target profile is private', async () => {
      mockSupabase.enqueue('profiles', createQuery({
        single: { data: { user_id: 'target-user', is_public: false }, error: null },
      }))

      await expect(repo.followUser('target-user')).rejects.toBeInstanceOf(NotFoundError)
      expect(mockSupabase.from).not.toHaveBeenCalledWith('user_follows')
    })

    it('throws NotFoundError without inserting when target profile is missing', async () => {
      mockSupabase.enqueue('profiles', createQuery({
        single: { data: null, error: { message: 'No rows', code: 'PGRST116' } },
      }))

      await expect(repo.followUser('target-user')).rejects.toBeInstanceOf(NotFoundError)
      expect(mockSupabase.from).not.toHaveBeenCalledWith('user_follows')
    })

    it('throws NetworkError without inserting when target profile lookup fails unexpectedly', async () => {
      mockSupabase.enqueue('profiles', createQuery({
        single: { data: null, error: { message: 'database unavailable', code: '500' } },
      }))

      await expect(repo.followUser('target-user')).rejects.toBeInstanceOf(NetworkError)
      expect(mockSupabase.from).not.toHaveBeenCalledWith('user_follows')
    })

    it('throws ValidationError when trying to follow yourself', async () => {
      await expect(repo.followUser('current-user')).rejects.toThrow('Cannot follow yourself')
    })
  })

  describe('unfollowUser', () => {
    it('deletes follow record for target user', async () => {
      await repo.unfollowUser('target-user')

      expect(mockSupabase.from).toHaveBeenCalledWith('user_follows')
      expect(mockSupabase.chainableQuery.delete).toHaveBeenCalledWith({ count: 'exact' })
    })
  })

  describe('getFollowers', () => {
    it('returns visible UserFollow rows for public profiles', async () => {
      enqueueTargetProfile(mockSupabase, true)
      enqueueFollowRows(mockSupabase, [mockFollowRow])
      enqueueRelatedProfiles(mockSupabase, [{ user_id: 'current-user', is_public: false }])

      const result = await repo.getFollowers('target-user')

      expect(result).toEqual([expectedFollow])
      expect(mockSupabase.from).toHaveBeenCalledWith('user_follows')
    })

    it('denies non-owner reads of a private target followers list', async () => {
      enqueueTargetProfile(mockSupabase, false)

      await expect(repo.getFollowers('target-user')).rejects.toBeInstanceOf(NotFoundError)
      expect(mockSupabase.from).not.toHaveBeenCalledWith('user_follows')
    })

    it('allows owners to read their own private followers list without related-profile filtering', async () => {
      enqueueFollowRows(mockSupabase, [mockFollowRow])

      const result = await repo.getFollowers('current-user')

      expect(result).toEqual([expectedFollow])
      expect(mockSupabase.from).toHaveBeenCalledTimes(1)
      expect(mockSupabase.from).toHaveBeenCalledWith('user_follows')
    })

    it('filters private follower rows for public target profiles while keeping the current viewer', async () => {
      const publicFollower = {
        ...mockFollowRow,
        id: 'follow-2',
        follower_id: 'public-follower',
      }
      const privateFollower = {
        ...mockFollowRow,
        id: 'follow-3',
        follower_id: 'private-follower',
      }
      enqueueTargetProfile(mockSupabase, true)
      enqueueFollowRows(mockSupabase, [mockFollowRow, publicFollower, privateFollower])
      enqueueRelatedProfiles(mockSupabase, [
        { user_id: 'current-user', is_public: false },
        { user_id: 'public-follower', is_public: true },
        { user_id: 'private-follower', is_public: false },
      ])

      const result = await repo.getFollowers('target-user')

      expect(result.map((follow) => follow.id)).toEqual(['follow-1', 'follow-2'])
    })
  })

  describe('getFollowing', () => {
    it('returns visible UserFollow rows for public profiles', async () => {
      const visibleFollow = {
        ...mockFollowRow,
        follower_id: 'target-user',
        following_id: 'current-user',
      }
      enqueueTargetProfile(mockSupabase, true)
      enqueueFollowRows(mockSupabase, [visibleFollow])
      enqueueRelatedProfiles(mockSupabase, [{ user_id: 'current-user', is_public: false }])

      const result = await repo.getFollowing('target-user')

      expect(result).toEqual([{
        id: 'follow-1',
        followerId: 'target-user',
        followingId: 'current-user',
        createdAt: '2026-01-01T00:00:00.000Z',
      }])
    })

    it('denies non-owner reads of a private target following list', async () => {
      enqueueTargetProfile(mockSupabase, false)

      await expect(repo.getFollowing('target-user')).rejects.toBeInstanceOf(NotFoundError)
      expect(mockSupabase.from).not.toHaveBeenCalledWith('user_follows')
    })

    it('filters private following rows for public target profiles while keeping the current viewer', async () => {
      const publicFollowing = {
        ...mockFollowRow,
        id: 'follow-2',
        follower_id: 'target-user',
        following_id: 'public-following',
      }
      const privateFollowing = {
        ...mockFollowRow,
        id: 'follow-3',
        follower_id: 'target-user',
        following_id: 'private-following',
      }
      const viewerFollowing = {
        ...mockFollowRow,
        id: 'follow-4',
        follower_id: 'target-user',
        following_id: 'current-user',
      }
      enqueueTargetProfile(mockSupabase, true)
      enqueueFollowRows(mockSupabase, [publicFollowing, privateFollowing, viewerFollowing])
      enqueueRelatedProfiles(mockSupabase, [
        { user_id: 'public-following', is_public: true },
        { user_id: 'private-following', is_public: false },
        { user_id: 'current-user', is_public: false },
      ])

      const result = await repo.getFollowing('target-user')

      expect(result.map((follow) => follow.id)).toEqual(['follow-2', 'follow-4'])
    })
  })

  describe('getFollowCounts', () => {
    it('returns FollowCounts with followerCount, followingCount, isFollowing', async () => {
      let fromCallIndex = 0
      mockSupabase.from.mockImplementation(() => {
        fromCallIndex++
        if (fromCallIndex === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 5 }),
            }),
          }
        }
        if (fromCallIndex === 2) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 3 }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'follow-1' } }),
              }),
            }),
          }),
        }
      })

      const result = await repo.getFollowCounts('target-user')

      expect(result).toEqual({
        followerCount: 5,
        followingCount: 3,
        isFollowing: true,
      })
    })
  })

  describe('isFollowing', () => {
    it('returns true when following the target user', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValue({
        data: { id: 'follow-1' },
      })

      const result = await repo.isFollowing('target-user')
      expect(result).toBe(true)
    })

    it('returns false when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const result = await repo.isFollowing('target-user')
      expect(result).toBe(false)
    })
  })
})
