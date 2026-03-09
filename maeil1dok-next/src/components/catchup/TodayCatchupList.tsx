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
    [localItems]
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

      setLocalItems((previous) => previous.map((value) => (value.id === item.id ? { ...value, isCompleted: true } : value)))
      onItemCompleted(item.id)
    } catch {
      setError('완료 상태를 저장하지 못했습니다')
    } finally {
      setPendingId(null)
    }
  }

  const completedCount = sortedItems.filter(item => item.isCompleted).length

  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 border-b border-[var(--color-border-subtle)] pb-3">
        <span className="text-base">📚</span>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">따라잡기</h3>
        <span className="text-xs text-[var(--color-text-secondary)]">({completedCount}/{sortedItems.length})</span>
      </div>

      <div className="space-y-2">
        {sortedItems.length === 0 ? (
           <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">오늘 예정된 따라잡기 스케줄이 없습니다.</p>
        ) : (
          sortedItems.map((item) => (
            <div
              key={item.id}
               className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-surface-secondary)]"
            >
              <input
                type="checkbox"
                checked={item.isCompleted}
                disabled={item.isCompleted || pendingId === item.id}
                onChange={() => handleComplete(item)}
                className="h-5 w-5 rounded border-[var(--color-border)] text-blue-600 disabled:opacity-60"
                aria-label={`${item.book} ${item.startChapter}-${item.endChapter} 완료`}
              />
              <div className="flex-1">
                <p className={`text-sm font-medium ${item.isCompleted ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
                  {item.book}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {item.startChapter}장{item.startChapter !== item.endChapter ? `-${item.endChapter}장` : ''}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
