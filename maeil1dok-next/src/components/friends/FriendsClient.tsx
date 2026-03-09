'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Search } from 'lucide-react'
import FriendCard from '@/components/friends/FriendCard'

interface FollowRow {
  id: string
  followerId: string
  followingId: string
  createdAt: string
}

interface FriendItem {
  userId: string
  nickname: string
  avatarUrl?: string
  recentActivity: string
  isFollowing: boolean
}

export interface FriendProfilePreview {
  userId: string
  nickname: string
  avatarUrl?: string
}

interface FriendsClientProps {
  profiles: FriendProfilePreview[]
}

function formatRelativeActivity(value: string): string {
  const now = Date.now()
  const target = new Date(value).getTime()

  if (Number.isNaN(target)) return '최근 활동 정보 없음'

  const diffSeconds = Math.max(0, Math.floor((now - target) / 1000))
  if (diffSeconds < 60) return '방금 전 활동'

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}분 전 활동`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}시간 전 활동`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}일 전 활동`

  return new Date(value).toLocaleDateString('ko-KR')
}

function getFallbackNickname(userId: string) {
  return `사용자 ${userId.slice(0, 8)}`
}

export default function FriendsClient({ profiles }: FriendsClientProps) {
  const [query, setQuery] = useState('')
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  const profilesById = useMemo(() => {
    const map = new Map<string, FriendProfilePreview>()
    profiles.forEach((profile) => {
      map.set(profile.userId, profile)
    })
    return map
  }, [profiles])

  const loadFriends = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/profile/following?limit=100', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('친구 목록을 불러오지 못했습니다.')
      }

      const rows = (await response.json()) as FollowRow[]
      const nextFriends = rows.map((row) => {
        const profile = profilesById.get(row.followingId)
        return {
          userId: row.followingId,
          nickname: profile?.nickname ?? getFallbackNickname(row.followingId),
          avatarUrl: profile?.avatarUrl,
          recentActivity: formatRelativeActivity(row.createdAt),
          isFollowing: true,
        }
      })

      setFriends(nextFriends)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : '친구 목록을 불러오지 못했습니다.'
      setError(message)
      setFriends([])
    } finally {
      setIsLoading(false)
    }
  }, [profilesById])

  useEffect(() => {
    void loadFriends()
  }, [loadFriends])

  const filteredFriends = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return friends
    return friends.filter((friend) => friend.nickname.toLowerCase().includes(normalized))
  }, [friends, query])

  const toggleFollow = useCallback(async (targetUserId: string, nextFollowing: boolean) => {
    const previousFriends = friends
    setPendingUserId(targetUserId)

    setFriends((current) =>
      current.map((friend) =>
        friend.userId === targetUserId
          ? {
              ...friend,
              isFollowing: nextFollowing,
            }
          : friend,
      ),
    )

    try {
      const endpoint = nextFollowing ? '/api/profile/follow' : '/api/profile/unfollow'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      })

      if (!response.ok) {
        throw new Error('팔로우 상태를 변경하지 못했습니다.')
      }
    } catch {
      setFriends(previousFriends)
    } finally {
      setPendingUserId(null)
    }
  }, [friends])

  return (
    <main className="mx-auto min-h-[calc(100dvh-120px)] max-w-[768px] bg-[var(--color-bg-primary)] pb-24">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border-light)] bg-[var(--color-bg-card)]">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link
            href="/"
            className="-m-2 rounded-lg p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
            aria-label="뒤로 가기"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
          <h1 className="text-lg font-semibold tracking-[-0.05em] text-[var(--color-text-primary)]">친구</h1>
        </div>
      </header>

       <section className="space-y-4 px-4 py-4">
         <div className="relative">
           <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[var(--color-text-tertiary)]" aria-hidden="true" />
           <input
             type="text"
             value={query}
             onChange={(event) => setQuery(event.target.value)}
             placeholder="친구 검색"
             className="h-12 w-full rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-card)] pr-4 pl-11 text-[0.9375rem] text-[var(--color-text-primary)] outline-none transition-all placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-text-tertiary)] focus:shadow-[0_0_0_3px_rgba(107,114,128,0.1)]"
           />
         </div>

         {isLoading ? (
           <div className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-card)] px-5 py-10 text-center text-[0.9375rem] text-[var(--color-text-secondary)]">
             친구 목록을 불러오는 중입니다...
           </div>
         ) : error ? (
           <div className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-5 py-10 text-center">
             <p className="text-[0.9375rem] text-[#B91C1C]">{error}</p>
             <button
               type="button"
               onClick={() => void loadFriends()}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-[8px] border border-[#FCA5A5] bg-[var(--color-surface)] px-3 text-[0.8125rem] font-medium text-[#B91C1C]"
             >
               다시 시도
             </button>
           </div>
         ) : filteredFriends.length === 0 ? (
           <div className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-card)] px-5 py-10 text-center">
             <p className="text-[0.9375rem] text-[var(--color-text-primary)]">
               {query.trim() ? '검색 결과가 없습니다' : '아직 친구가 없습니다'}
             </p>
             <p className="mt-1 text-[0.8125rem] text-[var(--color-text-tertiary)]">
               {query.trim() ? '다른 이름으로 검색해보세요.' : '팔로우한 사용자가 여기에 표시됩니다.'}
             </p>
           </div>
         ) : (
          <div className="space-y-3">
            {filteredFriends.map((friend) => (
              <FriendCard
                key={friend.userId}
                id={friend.userId}
                nickname={friend.nickname}
                avatarUrl={friend.avatarUrl}
                recentActivity={friend.recentActivity}
                isFollowing={friend.isFollowing}
                isPending={pendingUserId === friend.userId}
                onToggleFollow={toggleFollow}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
