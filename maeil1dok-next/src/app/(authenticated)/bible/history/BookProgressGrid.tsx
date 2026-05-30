'use client'

import Link from 'next/link'
import { useState } from 'react'

interface BookItem {
  id: string
  name: string
  testament: 'old' | 'new'
  read: number
  total: number
}

type FilterKey = 'all' | 'old' | 'new'

interface BookProgressGridProps {
  books: BookItem[]
}

export function BookProgressGrid({ books }: BookProgressGridProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filteredBooks = filter === 'all' ? books : books.filter((book) => book.testament === filter)

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">책별 진도</h2>
        <div className="flex items-center gap-2">
          {([{ key: 'all', label: '전체' }, { key: 'old', label: '구약' }, { key: 'new', label: '신약' }] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filter === tab.key
                  ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
              ].join(' ')}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
        {filteredBooks.map((book) => {
          const isCompleted = book.total > 0 && book.read >= book.total
          const chapterProgress = book.total > 0 ? (book.read / book.total) * 100 : 0
          return (
            <Link
              key={book.id}
              href={`/bible?book=${book.id}&chapter=1`}
              className={[
                'rounded-lg border p-3 transition-all hover:-translate-y-[2px] hover:shadow-[var(--shadow-md)]',
                isCompleted ? 'border-[var(--color-success)] bg-[var(--color-success-bg)]' : 'border-[var(--color-border)] bg-[var(--color-bg-card)]',
              ].join(' ')}
            >
              <p className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">{book.name}</p>
              <p className="mb-1 text-xs text-[var(--color-text-muted)]">{book.read} / {book.total}장</p>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
                <div className="h-full rounded-full bg-[var(--color-success)]" style={{ width: `${Math.min(chapterProgress, 100)}%` }} />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
