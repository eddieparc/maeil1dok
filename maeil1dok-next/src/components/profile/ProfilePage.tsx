'use client'

import { useMemo, useState } from 'react'
import type { FollowCounts, UserProfile } from '@/types'
import FollowersModal from './FollowersModal'
import FollowingModal from './FollowingModal'

interface ProfilePageProps {
  profile: UserProfile
  followCounts: FollowCounts
  isFollowing: boolean
  isOwnProfile: boolean
  currentUserId: string
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  )
}

export default function ProfilePage({
  profile,
  followCounts,
  isFollowing,
  isOwnProfile,
  currentUserId,
}: ProfilePageProps) {
  const [isFollowingState, setIsFollowingState] = useState(isFollowing)
  const [localFollowCounts, setLocalFollowCounts] = useState({
    followerCount: followCounts.followerCount,
    followingCount: followCounts.followingCount,
  })
  const [showFollowers, setShowFollowers] = useState(false)
  const [showFollowing, setShowFollowing] = useState(false)
  const [isEditModalOpen, setEditModalOpen] = useState(false)

  const profileBio = useMemo(() => profile.bio?.trim() || '', [profile.bio])

  const handleFollowToggle = async () => {
    const wasFollowing = isFollowingState

    setIsFollowingState(!wasFollowing)
    setLocalFollowCounts((prev) => ({
      ...prev,
      followerCount: prev.followerCount + (wasFollowing ? -1 : 1),
    }))

    try {
      const endpoint = wasFollowing ? '/api/profile/unfollow' : '/api/profile/follow'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: profile.userId }),
      })

      if (!res.ok) {
        throw new Error('Failed to toggle follow')
      }
    } catch {
      setIsFollowingState(wasFollowing)
      setLocalFollowCounts((prev) => ({
        ...prev,
        followerCount: prev.followerCount + (wasFollowing ? 1 : -1),
      }))
    }
  }

  return (
    <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }} className="pb-20 pt-6">
      <div data-testid="profile-header" className="mx-4 mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 data-testid="profile-nickname" className="text-xl font-bold text-gray-900">
              {profile.nickname}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{profileBio}</p>
            <div className="mt-3 flex gap-4 text-sm text-gray-700">
              <button type="button" onClick={() => setShowFollowers(true)}>
                <span className="font-bold">{localFollowCounts.followerCount}</span> 팔로워
              </button>
              <button type="button" onClick={() => setShowFollowing(true)}>
                <span className="font-bold">{localFollowCounts.followingCount}</span> 팔로잉
              </button>
            </div>
          </div>

          {isOwnProfile ? (
            <button
              data-testid="profile-edit-button"
              type="button"
              onClick={() => setEditModalOpen(true)}
              aria-expanded={isEditModalOpen}
              className="text-sm text-blue-500"
            >
              편집
            </button>
          ) : (
            <button
              data-testid="follow-button"
              type="button"
              onClick={handleFollowToggle}
              className={`rounded-full px-4 py-2 text-sm ${isFollowingState ? 'bg-gray-200 text-gray-700' : 'bg-blue-500 text-white'}`}
            >
              {isFollowingState ? '팔로잉' : '팔로우'}
            </button>
          )}
        </div>
      </div>

      <div data-testid="profile-stats" className="mx-4 mb-4 grid grid-cols-3 gap-2">
        <StatCard label="현재 연속" value={profile.currentStreak || 0} />
        <StatCard label="총 완료일" value={profile.totalCompletedDays || 0} />
        <StatCard label="최장 연속" value={profile.longestStreak || 0} />
      </div>

      <FollowersModal
        isOpen={showFollowers}
        onClose={() => setShowFollowers(false)}
        userId={profile.userId}
        currentUserId={currentUserId}
      />
      <FollowingModal
        isOpen={showFollowing}
        onClose={() => setShowFollowing(false)}
        userId={profile.userId}
        currentUserId={currentUserId}
      />
    </main>
  )
}
