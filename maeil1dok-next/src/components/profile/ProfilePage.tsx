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
  accent = 'ink',
}: {
  label: string
  value: string
  accent?: 'ink' | 'brand'
}) {
  const valueColor = accent === 'brand' ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink)]'
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] px-2 py-3">
      <p
        className={`text-[18px] font-semibold -tracking-[0.025em] tabular-nums ${valueColor}`}
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        {value}
      </p>
      <p
        className="text-[11px] font-medium text-[var(--color-mute)] -tracking-[0.005em]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        {label}
      </p>
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
          className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] p-6"
        >
          <div className="mb-5 flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between">
            <div className="flex items-center gap-4">
              {localProfile.avatarUrl ? (
                <img
                  src={localProfile.avatarUrl}
                  alt={localProfile.nickname}
                  className="h-[72px] w-[72px] shrink-0 rounded-full border border-[var(--color-rule)] object-cover min-[480px]:h-20 min-[480px]:w-20"
                />
              ) : (
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-warm)] text-[var(--color-brand)] min-[480px]:h-20 min-[480px]:w-20">
                  <User size={32} aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0">
                <h1
                  data-testid="profile-nickname"
                  className="text-[var(--color-ink)] -tracking-[0.025em] leading-[1.25]"
                  style={{
                    fontFamily: 'var(--font-family-serif)',
                    fontSize: 'clamp(1.375rem, 5vw, 1.625rem)',
                    fontWeight: 500,
                  }}
                >
                  {localProfile.nickname}
                </h1>
                <p
                  className="mt-0.5 text-[12px] font-medium text-[var(--color-subtle)] -tracking-[0.005em]"
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  가입일 {formatDate(localProfile.createdAt)}
                </p>
                {profileBio ? (
                  <p
                    className="mt-2 text-[13px] leading-relaxed text-[var(--color-mute)] -tracking-[0.008em]"
                    style={{ fontFamily: 'var(--font-family-ui)' }}
                  >
                    {profileBio}
                  </p>
                ) : null}
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
                  className="h-10 min-w-[112px] rounded-full border border-[var(--color-rule)] bg-transparent px-4 text-[13px] font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)]"
                >
                  프로필 편집
                </Button>
              ) : (
                <Button
                  data-testid="follow-button"
                  variant={isFollowingState ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={handleFollowToggle}
                  className={
                    isFollowingState
                      ? 'h-10 min-w-[96px] rounded-full border border-[var(--color-rule)] bg-transparent px-4 text-[13px] font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)]'
                      : 'h-10 min-w-[96px] rounded-full bg-[var(--color-ink)] px-4 text-[13px] font-semibold text-[var(--color-paper)] hover:bg-[var(--color-brand-deep)]'
                  }
                >
                  {isFollowingState ? '언팔로우' : '팔로우'}
                </Button>
              )}
            </div>
          </div>

          <div
            className="mb-5 flex flex-wrap items-center gap-5 border-y border-[var(--color-rule)] py-4 text-[13px] font-medium text-[var(--color-mute)] -tracking-[0.008em]"
            style={{ fontFamily: 'var(--font-family-ui)' }}
          >
            <button type="button" onClick={() => setShowFollowers(true)} className="transition-colors hover:text-[var(--color-ink)]">
              <span className="mr-1 font-semibold text-[var(--color-ink)] tabular-nums">{localFollowCounts.followerCount}</span>
              팔로워
            </button>
            <button type="button" onClick={() => setShowFollowing(true)} className="transition-colors hover:text-[var(--color-ink)]">
              <span className="mr-1 font-semibold text-[var(--color-ink)] tabular-nums">{localFollowCounts.followingCount}</span>
              팔로잉
            </button>
          </div>

          <div data-testid="profile-stats" className="grid grid-cols-4 gap-2 max-[360px]:grid-cols-2">
            <StatCard label="완료한 일수" value={`${localProfile.totalCompletedDays || 0}일`} />
            <StatCard label="현재 연속" value={`${localProfile.currentStreak || 0}일`} accent="brand" />
            <StatCard label="최장 연속" value={`${localProfile.longestStreak || 0}일`} />
            <StatCard label="완료율" value={`${completionRate.toFixed(1)}%`} />
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
