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

interface FollowerItem {
  id: string
  userId: string
  nickname: string
  avatarUrl?: string
  bio: string
  isMe: boolean
  isFollowing: boolean
}

interface FollowersModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  currentUserId: string
  profileDirectory: UserProfile[]
}

function getFallbackNickname(userId: string) {
  return `사용자 ${userId.slice(0, 8)}`
}

export default function FollowersModal({
  isOpen,
  onClose,
  userId,
  currentUserId,
  profileDirectory,
}: FollowersModalProps) {
  const [followers, setFollowers] = useState<FollowerItem[]>([])
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

    const fetchFollowers = async () => {
      setIsLoading(true)
      try {
        const [followersRes, followingRes] = await Promise.all([
          fetch(`/api/profile/followers?userId=${encodeURIComponent(userId)}&limit=100`, { cache: 'no-store' }),
          fetch(`/api/profile/following?userId=${encodeURIComponent(currentUserId)}&limit=200`, { cache: 'no-store' }),
        ])

        if (!followersRes.ok || !followingRes.ok) {
          throw new Error('Failed to fetch followers')
        }

        const followerRows = (await followersRes.json()) as FollowRow[]
        const followingRows = (await followingRes.json()) as FollowRow[]
        const followingSet = new Set(followingRows.map((row) => row.followingId))

        const nextFollowers = followerRows.map((row) => {
          const profile = profileMap.get(row.followerId)
          const isMe = row.followerId === currentUserId

          return {
            id: row.id,
            userId: row.followerId,
            nickname: profile?.nickname ?? getFallbackNickname(row.followerId),
            avatarUrl: profile?.avatarUrl,
            bio: profile?.bio ?? '',
            isMe,
            isFollowing: isMe ? false : followingSet.has(row.followerId),
          }
        })

        if (isMounted) {
          setFollowers(nextFollowers)
        }
      } catch {
        if (isMounted) {
          setFollowers([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void fetchFollowers()

    return () => {
      isMounted = false
    }
  }, [currentUserId, isOpen, profileMap, userId])

  const toggleFollow = async (target: FollowerItem) => {
    if (target.isMe || pendingUserId === target.userId) return

    const nextFollowing = !target.isFollowing
    setPendingUserId(target.userId)
    setFollowers((current) =>
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
      setFollowers((current) =>
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
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">팔로워</h2>
        <button type="button" onClick={onClose} className="text-sm text-[var(--color-text-secondary)]">닫기</button>
      </Modal.Header>
      <Modal.Body className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-[var(--color-text-secondary)]">불러오는 중...</p>
        ) : followers.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[var(--color-text-primary)]">팔로워가 없습니다</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">다른 사용자들과 교류해보세요!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {followers.map((follower) => (
              <li key={follower.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border-default)] px-3 py-2">
                <Avatar url={follower.avatarUrl} name={follower.nickname} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{follower.nickname}</p>
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">{follower.bio || '소개가 없습니다.'}</p>
                </div>
                {!follower.isMe ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={follower.isFollowing ? 'secondary' : 'primary'}
                    onClick={() => void toggleFollow(follower)}
                    loading={pendingUserId === follower.userId}
                    className="h-8 min-w-[72px] rounded-lg px-3 text-xs"
                  >
                    {follower.isFollowing ? '언팔로우' : '팔로우'}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Modal.Body>
    </Modal>
  )
}
