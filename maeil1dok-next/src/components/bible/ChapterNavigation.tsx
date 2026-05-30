'use client'

import { BIBLE_BOOKS } from '@/lib/bible/books'

interface ChapterNavigationProps {
  book: string
  chapter: number
  bookKeys: string[]
  onBookChange: (book: string) => void
  onChapterChange: (chapter: number) => void
  onPrevChapter: () => void
  onNextChapter: () => void
}

function IconChevronLeft({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function IconChevronRight({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function IconChevronDown({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export default function ChapterNavigation({
  book,
  chapter,
  bookKeys,
  onBookChange,
  onChapterChange,
  onPrevChapter,
  onNextChapter,
}: ChapterNavigationProps) {
  const maxChapter = BIBLE_BOOKS[book]?.chapters ?? 1
  const isFirst = chapter <= 1
  const isLast = chapter >= maxChapter

  return (
    <nav
      aria-label="장 이동"
      className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        className="flex items-center gap-1 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)]/95 p-1 shadow-[var(--shadow-card)] backdrop-blur-md"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        <button
          type="button"
          onClick={onPrevChapter}
          disabled={isFirst}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[var(--color-mute)] -tracking-[0.005em] transition-colors hover:bg-[var(--color-brand-faint)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--color-mute)]"
          aria-label="이전 장"
        >
          <IconChevronLeft />
          이전
        </button>

        <div className="relative inline-flex items-center gap-0.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-paper)] -tracking-[0.005em]">
          <span className="tabular-nums">
            {BIBLE_BOOKS[book]?.ko ?? book} {chapter}장
          </span>
          <IconChevronDown />
          <select
            value={`${book}:${chapter}`}
            onChange={(event) => {
              const [nextBook, nextChapterRaw] = event.target.value.split(':')
              const nextChapter = Number.parseInt(nextChapterRaw, 10)
              if (nextBook !== book) {
                onBookChange(nextBook)
              } else if (Number.isFinite(nextChapter)) {
                onChapterChange(nextChapter)
              }
            }}
            aria-label="책과 장 선택"
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {bookKeys.map((bookKey) => {
              const bookData = BIBLE_BOOKS[bookKey]
              if (!bookData) return null
              return (
                <optgroup key={bookKey} label={bookData.ko}>
                  {Array.from({ length: bookData.chapters }, (_, index) => index + 1).map(
                    (chapterNo) => (
                      <option key={`${bookKey}:${chapterNo}`} value={`${bookKey}:${chapterNo}`}>
                        {bookData.ko} {chapterNo}장
                      </option>
                    ),
                  )}
                </optgroup>
              )
            })}
          </select>
        </div>

        <button
          type="button"
          onClick={onNextChapter}
          disabled={isLast}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[var(--color-mute)] -tracking-[0.005em] transition-colors hover:bg-[var(--color-brand-faint)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--color-mute)]"
          aria-label="다음 장"
        >
          다음
          <IconChevronRight />
        </button>
      </div>
    </nav>
  )
}
