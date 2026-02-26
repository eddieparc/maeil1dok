import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseProfileRepository } from '@/repositories/implementations/SupabaseProfileRepository'
import type { UserFollow } from '@/types'

function createMockSupabase() {
  const mockFrom = vi.fn()
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'current-user' } },
    }),
  }

  const chainableQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }

  mockFrom.mockReturnValue(chainableQuery)

  return {
    from: mockFrom,
    auth: mockAuth,
    chainableQuery,
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

describe('SupabaseProfileRepository — follow methods', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>
  let repo: SupabaseProfileRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    repo = new SupabaseProfileRepository(mockSupabase as never)
  })

  describe('followUser', () => {
    it('inserts follow record for target user', async () => {
      mockSupabase.chainableQuery.insert.mockResolvedValue({ error: null })

      await repo.followUser('target-user')

      expect(mockSupabase.from).toHaveBeenCalledWith('user_follows')
      expect(mockSupabase.chainableQuery.insert).toHaveBeenCalledWith({
        follower_id: 'current-user',
        following_id: 'target-user',
      })
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
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('follower_id', 'current-user')
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('following_id', 'target-user')
    })
  })

  describe('getFollowers', () => {
    it('returns array of UserFollow', async () => {
      mockSupabase.chainableQuery.range.mockResolvedValue({
        data: [mockFollowRow],
        error: null,
      })

      const result = await repo.getFollowers('target-user')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(expectedFollow)
      expect(mockSupabase.from).toHaveBeenCalledWith('user_follows')
    })
  })

  describe('getFollowing', () => {
    it('returns array of UserFollow', async () => {
      mockSupabase.chainableQuery.range.mockResolvedValue({
        data: [mockFollowRow],
        error: null,
      })

      const result = await repo.getFollowing('current-user')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(expectedFollow)
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
