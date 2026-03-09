'use client'

import { Loader2 } from 'lucide-react'

interface FriendCardProps {
  id: string
  nickname: string
  avatarUrl?: string
  recentActivity: string
  isFollowing: boolean
  isPending: boolean
  onToggleFollow: (targetUserId: string, nextFollowing: boolean) => void
}

function getInitial(name: string) {
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?'
}

export default function FriendCard({
  id,
  nickname,
  avatarUrl,
  recentActivity,
  isFollowing,
  isPending,
  onToggleFollow,
}: FriendCardProps) {
  return (
    <article className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-3">
         {avatarUrl ? (
           <img
             src={avatarUrl}
             alt={nickname}
             className="h-12 w-12 rounded-full border border-[var(--color-border-default)] object-cover"
           />
         ) : (
           <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)] text-[1rem] font-semibold text-[var(--color-text-primary)]">
             {getInitial(nickname)}
           </div>
         )}

         <div className="min-w-0 flex-1">
           <p className="truncate text-[0.9375rem] font-semibold text-[var(--color-text-primary)]">{nickname}</p>
           <p className="mt-0.5 truncate text-[0.8125rem] text-[var(--color-text-secondary)]">{recentActivity}</p>
         </div>

         <button
           type="button"
           disabled={isPending}
           onClick={() => onToggleFollow(id, !isFollowing)}
           className={[
             'inline-flex h-9 min-w-[84px] items-center justify-center rounded-[8px] border px-3 text-[0.8125rem] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70',
             isFollowing
               ? 'border-[var(--color-border-default)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'
               : 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:opacity-90',
           ].join(' ')}
         >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : isFollowing ? (
            '언팔로우'
          ) : (
            '팔로우'
          )}
        </button>
      </div>
    </article>
  )
}
