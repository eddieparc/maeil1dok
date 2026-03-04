'use client'

import { useEffect, useMemo, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { UserProfile } from '@/types'

interface FollowRow {
  id: string
  followerId: string
  followingId: string
  createdAt: string
}

interface FollowingItem {
  id: string
  userId: string
  nickname: string
  avatarUrl?: string
  bio: string
  isFollowing: boolean
}

interface FollowingModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  currentUserId: string
  profileDirectory: UserProfile[]
}

function getFallbackNickname(userId: string) {
  return `사용자 ${userId.slice(0, 8)}`
}

export default function FollowingModal({
  isOpen,
  onClose,
  userId,
  currentUserId,
  profileDirectory,
}: FollowingModalProps) {
  const [following, setFollowing] = useState<FollowingItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  const profileMap = useMemo(() => {
    const map = new Map<string, UserProfile>()
    profileDirectory.forEach((profile) => {
      map.set(profile.userId, profile)
    })
    return map
  }, [profileDirectory])

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true

    const fetchFollowing = async () => {
      setIsLoading(true)
      try {
        const [followingRes, myFollowingRes] = await Promise.all([
          fetch(`/api/profile/following?userId=${encodeURIComponent(userId)}&limit=100`, { cache: 'no-store' }),
          fetch(`/api/profile/following?userId=${encodeURIComponent(currentUserId)}&limit=200`, { cache: 'no-store' }),
        ])

        if (!followingRes.ok || !myFollowingRes.ok) {
          throw new Error('Failed to fetch following')
        }

        const followingRows = (await followingRes.json()) as FollowRow[]
        const myFollowingRows = (await myFollowingRes.json()) as FollowRow[]
        const myFollowingSet = new Set(myFollowingRows.map((row) => row.followingId))

        const nextFollowing = followingRows.map((row) => {
          const profile = profileMap.get(row.followingId)
          return {
            id: row.id,
            userId: row.followingId,
            nickname: profile?.nickname ?? getFallbackNickname(row.followingId),
            avatarUrl: profile?.avatarUrl,
            bio: profile?.bio ?? '',
            isFollowing: myFollowingSet.has(row.followingId),
          }
        })

        if (isMounted) {
          setFollowing(nextFollowing)
        }
      } catch {
        if (isMounted) {
          setFollowing([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void fetchFollowing()

    return () => {
      isMounted = false
    }
  }, [currentUserId, isOpen, profileMap, userId])

  const toggleFollow = async (target: FollowingItem) => {
    if (pendingUserId === target.userId) return

    const nextFollowing = !target.isFollowing
    setPendingUserId(target.userId)
    setFollowing((current) =>
      current.map((item) =>
        item.userId === target.userId
          ? {
              ...item,
              isFollowing: nextFollowing,
            }
          : item,
      ),
    )

    try {
      const endpoint = nextFollowing ? '/api/profile/follow' : '/api/profile/unfollow'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: target.userId }),
      })

      if (!response.ok) {
        throw new Error('toggle failed')
      }
    } catch {
      setFollowing((current) =>
        current.map((item) =>
          item.userId === target.userId
            ? {
                ...item,
                isFollowing: target.isFollowing,
              }
            : item,
        ),
      )
    } finally {
      setPendingUserId(null)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <Modal.Header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">팔로잉</h2>
        <button type="button" onClick={onClose} className="text-sm text-[var(--color-text-secondary)]">닫기</button>
      </Modal.Header>
      <Modal.Body className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-[var(--color-text-secondary)]">불러오는 중...</p>
        ) : following.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[15px] text-[var(--color-text-primary)]">팔로잉이 없습니다</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">다른 사용자를 팔로우해보세요!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {following.map((followedUser) => (
              <li key={followedUser.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border-default)] px-3 py-2">
                <Avatar url={followedUser.avatarUrl} name={followedUser.nickname} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{followedUser.nickname}</p>
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">{followedUser.bio || '소개가 없습니다.'}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={followedUser.isFollowing ? 'secondary' : 'primary'}
                  onClick={() => void toggleFollow(followedUser)}
                  loading={pendingUserId === followedUser.userId}
                  className="h-8 min-w-[72px] rounded-lg px-3 text-xs"
                >
                  {followedUser.isFollowing ? '언팔로우' : '팔로우'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal.Body>
    </Modal>
  )
}
