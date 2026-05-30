'use client'

import { cn } from '@/lib/utils'

interface UsageTipsProps {
  hasBookmarks: boolean
  hasNotes: boolean
  hasHighlights: boolean
  canDismiss: boolean
  onDismiss: () => void
}

interface TipItemProps {
  emoji: string
  title: string
  description: React.ReactNode
}

function TipItem({ emoji, title, description }: TipItemProps) {
  return (
    <div className="flex gap-3 rounded-2xl bg-[var(--color-brand-faint)] p-3.5">
      <span className="shrink-0 text-xl">{emoji}</span>
      <div>
        <strong
          className="mb-1 block text-[14px] font-semibold text-[var(--color-ink)] -tracking-[0.01em]"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {title}
        </strong>
        <p
          className="text-[13px] leading-relaxed text-[var(--color-mute)] -tracking-[0.008em]"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {description}
        </p>
      </div>
    </div>
  )
}

export default function UsageTips({
  hasBookmarks,
  hasNotes,
  hasHighlights,
  canDismiss,
  onDismiss,
}: UsageTipsProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] p-4',
      )}
    >
      <h2
        className="mb-3 text-[13px] font-semibold text-[var(--color-ink)] -tracking-[0.008em]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        💡 사용 팁
      </h2>
      <div className="flex flex-col gap-3.5">
        {!hasHighlights && (
          <TipItem
            emoji="✨"
            title="하이라이트 만들기"
            description={
              <>
                성경 본문에서 텍스트를{' '}
                <em className="not-italic font-medium text-[var(--color-brand)]">
                  드래그
                </em>
                하면 하이라이트, 복사, 공유 메뉴가 나타나요
              </>
            }
          />
        )}
        {!hasBookmarks && (
          <TipItem
            emoji="🔖"
            title="북마크 추가하기"
            description={
              <>
                성경 읽기 화면 상단의{' '}
                <em className="not-italic font-medium text-[var(--color-brand)]">
                  북마크 아이콘
                </em>
                을 눌러 현재 장을 저장하세요
              </>
            }
          />
        )}
        {!hasNotes && (
          <TipItem
            emoji="📝"
            title="묵상노트 작성하기"
            description={
              <>
                읽기 화면의{' '}
                <em className="not-italic font-medium text-[var(--color-brand)]">
                  메뉴(⋮)
                </em>
                에서 묵상노트를 작성할 수 있어요
              </>
            }
          />
        )}
      </div>
      {canDismiss && (
        <button
          type="button"
          className={cn(
            'mt-3 block w-full text-center text-[11px] font-medium text-[var(--color-subtle)] -tracking-[0.005em]',
            'transition-colors hover:text-[var(--color-mute)]',
          )}
          style={{ fontFamily: 'var(--font-family-ui)' }}
          onClick={onDismiss}
        >
          다음부터 표시 안함
        </button>
      )}
    </section>
  )
}
