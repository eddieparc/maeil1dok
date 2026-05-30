'use client'

import { useMemo, useState } from 'react'

export interface TodayCatchupItem {
  id: string
  date: string
  isCompleted: boolean
  book: string
  startChapter: number
  endChapter: number
}

interface TodayCatchupListProps {
  items: TodayCatchupItem[]
  onItemCompleted: (itemId: string) => void
}

export function TodayCatchupList({ items, onItemCompleted }: TodayCatchupListProps) {
  const [localItems, setLocalItems] = useState(items)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sortedItems = useMemo(
    () => [...localItems].sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted)),
    [localItems],
  )

  const handleComplete = async (item: TodayCatchupItem) => {
    if (item.isCompleted || pendingId) return

    setPendingId(item.id)
    setError(null)

    try {
      const response = await fetch('/api/catchup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: item.id, date: item.date }),
      })

      if (!response.ok) {
        throw new Error('failed')
      }

      setLocalItems((previous) =>
        previous.map((value) => (value.id === item.id ? { ...value, isCompleted: true } : value)),
      )
      onItemCompleted(item.id)
    } catch {
      setError('완료 상태를 저장하지 못했습니다')
    } finally {
      setPendingId(null)
    }
  }

  const completedCount = sortedItems.filter((item) => item.isCompleted).length

  return (
    <div className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-[var(--color-rule)] pb-3">
        <h3
          className="flex-1 text-[13px] font-semibold text-[var(--color-ink)] -tracking-[0.008em]"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          오늘 따라잡기
        </h3>
        <span
          className="rounded-full bg-[var(--color-brand-faint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-brand)] -tracking-[0.005em] tabular-nums"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {completedCount} / {sortedItems.length}
        </span>
      </div>

      <div className="space-y-1.5">
        {sortedItems.length === 0 ? (
          <p
            className="py-6 text-center text-[13px] font-medium text-[var(--color-mute)] -tracking-[0.008em]"
            style={{ fontFamily: 'var(--font-family-ui)' }}
          >
            오늘 예정된 따라잡기 스케줄이 없습니다
          </p>
        ) : (
          sortedItems.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 transition-colors hover:border-[var(--color-rule)] hover:bg-[var(--color-brand-faint)]"
            >
              <input
                type="checkbox"
                checked={item.isCompleted}
                disabled={item.isCompleted || pendingId === item.id}
                onChange={() => handleComplete(item)}
                className="h-5 w-5 cursor-pointer appearance-none rounded-full border-[1.5px] border-[var(--color-rule)] bg-[var(--color-paper)] transition-colors checked:border-[var(--color-ink)] checked:bg-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundImage: item.isCompleted
                    ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6L9 17L4 12'/%3E%3C/svg%3E")`
                    : undefined,
                  backgroundSize: '12px',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
                aria-label={`${item.book} ${item.startChapter}-${item.endChapter} 완료`}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[14px] -tracking-[0.01em] ${
                    item.isCompleted
                      ? 'font-medium text-[var(--color-mute)] line-through'
                      : 'font-semibold text-[var(--color-ink)]'
                  }`}
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  {item.book}
                </p>
                <p
                  className="text-[11px] font-medium text-[var(--color-subtle)] -tracking-[0.005em] tabular-nums"
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  {item.startChapter}장
                  {item.startChapter !== item.endChapter ? `-${item.endChapter}장` : ''}
                </p>
              </div>
            </label>
          ))
        )}
      </div>

      {error ? (
        <p
          className="mt-3 text-[11px] font-medium text-[var(--color-danger)] -tracking-[0.005em]"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
