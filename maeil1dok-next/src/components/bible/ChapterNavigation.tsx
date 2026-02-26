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

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1.5 text-sm text-gray-600">
          <span className="text-xs font-medium tracking-wide text-gray-500">성경 책</span>
          <select
            value={book}
            onChange={(event) => onBookChange(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-400 focus:outline-none"
          >
            {bookKeys.map((key) => (
              <option key={key} value={key}>
                {BIBLE_BOOKS[key].ko}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1.5 text-sm text-gray-600">
          <span className="text-xs font-medium tracking-wide text-gray-500">장</span>
          <select
            value={chapter}
            onChange={(event) => onChapterChange(Number.parseInt(event.target.value, 10))}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-400 focus:outline-none"
          >
            {Array.from({ length: maxChapter }, (_, index) => index + 1).map((chapterNo) => (
              <option key={chapterNo} value={chapterNo}>
                {chapterNo}장
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPrevChapter}
          disabled={chapter <= 1}
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-45"
        >
          이전 장
        </button>
        <button
          type="button"
          onClick={onNextChapter}
          disabled={chapter >= maxChapter}
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-45"
        >
          다음 장
        </button>
      </div>
    </section>
  )
}
