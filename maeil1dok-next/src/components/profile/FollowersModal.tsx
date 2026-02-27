'use client'

import { useEffect, useMemo, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">팔로워</h2>
          <button type="button" onClick={onClose} className="text-sm text-gray-500">닫기</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {emptyMessage ? (
            <p className="text-sm text-gray-500">{emptyMessage}</p>
          ) : (
            <ul className="space-y-3">
              {followers.map((follower) => (
                <li key={follower.id} className="rounded-xl border border-gray-100 px-3 py-2 flex items-center gap-2">
                  <Avatar url={undefined} name={getDisplayName(follower.followerId, currentUserId)} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {getDisplayName(follower.followerId, currentUserId)}
                    </p>
                    <p className="truncate text-xs text-gray-500">소개 정보가 없습니다.</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
