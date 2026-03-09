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
    <div className="flex gap-3 rounded-lg bg-[var(--color-bg-tertiary)] p-3">
      <span className="shrink-0 text-xl">{emoji}</span>
      <div>
        <strong className="mb-1 block text-sm text-[var(--color-text-primary)]">{title}</strong>
        <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-secondary)]">
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
        'rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-4',
      )}
    >
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
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
                <em className="not-italic font-medium text-[var(--color-accent-primary)]">
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
                <em className="not-italic font-medium text-[var(--color-accent-primary)]">
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
                <em className="not-italic font-medium text-[var(--color-accent-primary)]">
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
            'mt-3 block w-full text-center text-xs text-[var(--color-text-muted)]',
            'transition-colors hover:text-[var(--color-text-secondary)]',
          )}
          onClick={onDismiss}
        >
          다음부터 표시 안함
        </button>
      )}
    </section>
  )
}
