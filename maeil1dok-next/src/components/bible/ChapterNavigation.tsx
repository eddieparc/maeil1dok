import { BIBLE_BOOKS } from '@/lib/bible/books'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
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
    <section className="rounded-2xl bg-[var(--color-bg-secondary)] p-4 shadow-sm border border-[var(--color-border-default)]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="성경 책"
          value={book}
          onChange={(event) => onBookChange(event.target.value)}
        >
          {bookKeys.map((key) => (
            <option key={key} value={key}>
              {BIBLE_BOOKS[key].ko}
            </option>
          ))}
        </Select>

        <Select
          label="장"
          value={chapter}
          onChange={(event) => onChapterChange(Number.parseInt(event.target.value, 10))}
        >
          {Array.from({ length: maxChapter }, (_, index) => index + 1).map((chapterNo) => (
            <option key={chapterNo} value={chapterNo}>
              {chapterNo}장
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={onPrevChapter}
          disabled={chapter <= 1}
          className="w-full"
        >
          이전 장
        </Button>
        <Button
          variant="secondary"
          onClick={onNextChapter}
          disabled={chapter >= maxChapter}
          className="w-full"
        >
          다음 장
        </Button>
      </div>
    </section>
  )
}
