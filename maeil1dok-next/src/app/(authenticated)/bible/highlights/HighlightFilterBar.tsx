'use client'

import { BIBLE_BOOKS, BIBLE_BOOK_ORDER } from '@/lib/bible/books'

const OT_BOOK_KEYS = BIBLE_BOOK_ORDER.slice(0, 39)
const NT_BOOK_KEYS = BIBLE_BOOK_ORDER.slice(39)

export const HIGHLIGHT_COLOR_OPTIONS = [
  { value: 'yellow', name: '노랑', hex: '#FACC15' },
  { value: 'green', name: '초록', hex: '#4ADE80' },
  { value: 'blue', name: '파랑', hex: '#60A5FA' },
  { value: 'pink', name: '분홍', hex: '#F472B6' },
  { value: 'purple', name: '보라', hex: '#C084FC' },
] as const

export function resolveHighlightColor(value: string): string {
  if (!value) return '#FACC15'
  if (value.startsWith('#')) return value
  const found = HIGHLIGHT_COLOR_OPTIONS.find((option) => option.value === value)
  return found ? found.hex : value
}

interface HighlightFilterBarProps {
  bookFilter: string
  colorFilter: string
  onBookFilterChange: (value: string) => void
  onColorFilterChange: (value: string) => void
}

export function HighlightFilterBar({
  bookFilter,
  colorFilter,
  onBookFilterChange,
  onColorFilterChange,
}: HighlightFilterBarProps) {
  const bookOptions = {
    old: OT_BOOK_KEYS.map((book) => ({ key: book, name: BIBLE_BOOKS[book]?.ko ?? book })),
    newer: NT_BOOK_KEYS.map((book) => ({ key: book, name: BIBLE_BOOKS[book]?.ko ?? book })),
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-col gap-2">
        <select
          value={bookFilter}
          onChange={(event) => onBookFilterChange(event.target.value)}
          className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent-primary)]"
          aria-label="성경 권 필터"
        >
          <option value="">전체</option>
          <optgroup label="구약">
            {bookOptions.old.map((book) => (
              <option key={book.key} value={book.key}>{book.name}</option>
            ))}
          </optgroup>
          <optgroup label="신약">
            {bookOptions.newer.map((book) => (
              <option key={book.key} value={book.key}>{book.name}</option>
            ))}
          </optgroup>
        </select>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onColorFilterChange('')}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              colorFilter === ''
                ? 'border-[var(--color-text-primary)] bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
            ].join(' ')}
          >
            모든 색상
          </button>
          {HIGHLIGHT_COLOR_OPTIONS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => onColorFilterChange(color.value)}
              className={[
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                colorFilter === color.value
                  ? 'border-[var(--color-text-primary)] bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
              ].join(' ')}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: color.hex }}
                aria-hidden="true"
              />
              <span>{color.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
