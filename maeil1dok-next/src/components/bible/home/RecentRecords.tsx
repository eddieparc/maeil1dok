'use client'

import { cn } from '@/lib/utils'

interface RecentRecord {
  book: string
  bookName: string
  chapter: number
  readDate: string
}

interface RecentRecordsProps {
  records: RecentRecord[]
  onRecordClick: (book: string, chapter: number) => void
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7) return `${diff}일 전`

  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function getChapterUnit(bookCode: string): string {
  return bookCode === 'psa' ? '편' : '장'
}

export default function RecentRecords({
  records,
  onRecordClick,
}: RecentRecordsProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
        최근 읽은 성경
      </h2>
      <ul
        className={cn(
          'overflow-hidden rounded-xl border border-[var(--color-border-default)]',
          'bg-[var(--color-bg-secondary)]',
        )}
      >
        {records.map((record) => (
          <li
            key={`${record.book}-${record.chapter}-${record.readDate}`}
            className="border-b border-[var(--color-border-default)] last:border-b-0"
          >
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between px-4 py-3.5 text-left',
                'transition-colors hover:bg-[var(--color-bg-tertiary)]',
              )}
              onClick={() => onRecordClick(record.book, record.chapter)}
            >
              <span className="text-[0.9375rem] text-[var(--color-text-primary)]">
                {record.bookName} {record.chapter}
                {getChapterUnit(record.book)}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {formatDate(record.readDate)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
