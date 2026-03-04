'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from 'lucide-react'
import type { FollowCounts, UserProfile } from '@/types'
import Container from '@/components/ui/Container'
import Button from '@/components/ui/Button'
import FollowersModal from './FollowersModal'
import FollowingModal from './FollowingModal'
import { ProfileEditModal } from './ProfileEditModal'

interface ProfilePageProps {
  profile: UserProfile
  followCounts: FollowCounts
  isFollowing: boolean
  isOwnProfile: boolean
  currentUserId: string
  profileDirectory: UserProfile[]
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'primary' | 'success' | 'violet' | 'orange'
}) {
  const toneClass = {
    primary: 'text-[var(--color-text-primary)]',
    success: 'text-[#059669]',
    violet: 'text-[#7C3AED]',
    orange: 'text-[#EA580C]',
  }[tone]

  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-[var(--color-bg-tertiary)] px-2 py-3">
      <p className={`text-lg font-bold ${toneClass}`}>{value}</p>
      <p className="text-[11px] font-medium text-[var(--color-text-secondary)]">{label}</p>
    </div>
  )
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getCompletionRate(days: number) {
  return Math.min(100, (days / 365) * 100)
}

export default function ProfilePage({
  profile,
  followCounts,
  isFollowing,
  isOwnProfile,
  currentUserId,
  profileDirectory,
}: ProfilePageProps) {
  const router = useRouter()
  const [localProfile, setLocalProfile] = useState(profile)
  const [isFollowingState, setIsFollowingState] = useState(isFollowing)
  const [localFollowCounts, setLocalFollowCounts] = useState({
    followerCount: followCounts.followerCount,
    followingCount: followCounts.followingCount,
  })
  const [showFollowers, setShowFollowers] = useState(false)
  const [showFollowing, setShowFollowing] = useState(false)
  const [isEditModalOpen, setEditModalOpen] = useState(false)

  const profileBio = useMemo(() => localProfile.bio?.trim() || '', [localProfile.bio])
  const completionRate = useMemo(
    () => getCompletionRate(localProfile.totalCompletedDays || 0),
    [localProfile.totalCompletedDays],
  )

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
        body: JSON.stringify({ targetUserId: localProfile.userId }),
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

  const handleSaveProfile = (nextProfile: UserProfile) => {
    setLocalProfile((prev) => ({
      ...prev,
      ...nextProfile,
    }))
    router.refresh()
  }

  return (
    <Container fullHeight className="pb-20 pt-4">
      <div className="mx-auto flex w-full max-w-[768px] flex-col gap-4 px-4">
        <section
          data-testid="profile-header"
          className="rounded-[20px] border border-black/[0.02] bg-[var(--color-bg-card)] p-6 shadow-[0_4px_20px_rgba(44,51,51,0.04)]"
        >
          <div className="mb-5 flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between">
            <div className="flex items-center gap-4">
              {localProfile.avatarUrl ? (
                <img
                  src={localProfile.avatarUrl}
                  alt={localProfile.nickname}
                  className="h-[72px] w-[72px] shrink-0 rounded-full border-2 border-[var(--color-bg-card)] object-cover shadow-[0_2px_8px_rgba(0,0,0,0.1)] min-[480px]:h-20 min-[480px]:w-20"
                />
              ) : (
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[#6B8F71] text-white shadow-[0_2px_8px_rgba(0,0,0,0.1)] min-[480px]:h-20 min-[480px]:w-20">
                  <User size={32} aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0">
                <h1 data-testid="profile-nickname" className="text-xl font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
                  {localProfile.nickname}
                </h1>
                <p className="text-[13px] text-[var(--color-text-secondary)]">
                  가입일: {formatDate(localProfile.createdAt)}
                </p>
                {profileBio ? <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{profileBio}</p> : null}
              </div>
            </div>

            <div className="flex gap-2">
              {isOwnProfile ? (
                <Button
                  data-testid="profile-edit-button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditModalOpen(true)}
                  aria-expanded={isEditModalOpen}
                  className="h-10 min-w-[112px] rounded-xl border border-[var(--color-border-default)] px-4 text-sm"
                >
                  프로필 편집
                </Button>
              ) : (
                <Button
                  data-testid="follow-button"
                  variant={isFollowingState ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={handleFollowToggle}
                  className="h-10 min-w-[96px] rounded-xl px-4 text-sm"
                >
                  {isFollowingState ? '언팔로우' : '팔로우'}
                </Button>
              )}
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-4 border-y border-[var(--color-border-light)] py-4 text-sm text-[var(--color-text-secondary)]">
            <button type="button" onClick={() => setShowFollowers(true)} className="transition-colors hover:text-[var(--color-text-primary)]">
              <span className="mr-1 font-bold text-[var(--color-text-primary)]">{localFollowCounts.followerCount}</span>
              팔로워
            </button>
            <button type="button" onClick={() => setShowFollowing(true)} className="transition-colors hover:text-[var(--color-text-primary)]">
              <span className="mr-1 font-bold text-[var(--color-text-primary)]">{localFollowCounts.followingCount}</span>
              팔로잉
            </button>
          </div>

          <div data-testid="profile-stats" className="grid grid-cols-4 gap-2 max-[360px]:grid-cols-2">
            <StatCard label="완료한 일수" value={`${localProfile.totalCompletedDays || 0}일`} tone="primary" />
            <StatCard label="현재 연속" value={`${localProfile.currentStreak || 0}일`} tone="success" />
            <StatCard label="최장 연속" value={`${localProfile.longestStreak || 0}일`} tone="violet" />
            <StatCard label="완료율" value={`${completionRate.toFixed(1)}%`} tone="orange" />
          </div>
        </section>
      </div>

      <FollowersModal
        isOpen={showFollowers}
        onClose={() => setShowFollowers(false)}
        userId={localProfile.userId}
        currentUserId={currentUserId}
        profileDirectory={profileDirectory}
      />
      <FollowingModal
        isOpen={showFollowing}
        onClose={() => setShowFollowing(false)}
        userId={localProfile.userId}
        currentUserId={currentUserId}
        profileDirectory={profileDirectory}
      />
      <ProfileEditModal
        isOpen={isEditModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={localProfile}
        onSave={handleSaveProfile}
      />
    </Container>
  )
}
