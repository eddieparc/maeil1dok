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

  return (
    <section data-testid="catchup-today-list" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">오늘의 캐치업</h3>
      {sortedItems.length === 0 ? <p className="mt-2 text-sm text-gray-500">오늘 배정된 캐치업 일정이 없습니다.</p> : null}

      <ul className="mt-3 space-y-2">
        {sortedItems.map((item) => (
          <li
            key={item.id}
            data-testid="catchup-reading-item"
            className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{item.book}</p>
              <p className="text-xs text-gray-500">
                {item.startChapter}장 - {item.endChapter}장
              </p>
            </div>

            <input
              type="checkbox"
              checked={item.isCompleted}
              disabled={item.isCompleted || pendingId === item.id}
              onChange={() => handleComplete(item)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 disabled:opacity-70"
              aria-label={`${item.book} ${item.startChapter}-${item.endChapter} 완료`}
            />
          </li>
        ))}
      </ul>

      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
    </section>
  )
}
