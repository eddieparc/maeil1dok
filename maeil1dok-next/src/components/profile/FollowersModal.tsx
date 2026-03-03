'use client'

import { useEffect, useMemo, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
interface FollowRow {
  id: string
  followerId: string
  followingId: string
  createdAt: string
}

interface FollowersModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  currentUserId: string
}

function getDisplayName(userId: string, currentUserId: string): string {
  if (userId === currentUserId) return '나'
  return `사용자 ${userId.slice(0, 8)}`
}

export default function FollowersModal({ isOpen, onClose, userId, currentUserId }: FollowersModalProps) {
  const [followers, setFollowers] = useState<FollowRow[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true

    const fetchFollowers = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/profile/followers?userId=${encodeURIComponent(userId)}`)
        if (!res.ok) throw new Error('Failed')
        const data = (await res.json()) as FollowRow[]
        if (isMounted) setFollowers(data)
      } catch {
        if (isMounted) setFollowers([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void fetchFollowers()
    return () => {
      isMounted = false
    }
  }, [isOpen, userId])

  const emptyMessage = useMemo(() => {
    if (isLoading) return '불러오는 중...'
    if (followers.length === 0) return '팔로워가 없습니다.'
    return null
  }, [followers.length, isLoading])

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <Modal.Header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">팔로워</h2>
        <button type="button" onClick={onClose} className="text-sm text-[var(--color-text-secondary)]">닫기</button>
      </Modal.Header>
      <Modal.Body className="max-h-[60vh] overflow-y-auto">
        {emptyMessage ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3">
            {followers.map((follower) => (
              <li key={follower.id} className="rounded-xl border border-[var(--color-border-default)] px-3 py-2 flex items-center gap-2">
                <Avatar url={undefined} name={getDisplayName(follower.followerId, currentUserId)} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {getDisplayName(follower.followerId, currentUserId)}
                  </p>
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">소개 정보가 없습니다.</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal.Body>
    </Modal>
  )
}
