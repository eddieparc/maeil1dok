import BibleViewer from '@/components/bible/BibleViewer'
import { BIBLE_BOOKS, BIBLE_BOOK_KEYS, isBibleVersion, type BibleVersion } from '@/lib/bible/books'

interface BiblePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function getSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export default async function BiblePage({ searchParams }: BiblePageProps) {
  const params = await searchParams

  const rawBook = getSingleValue(params.book) ?? 'gen'
  const book = rawBook in BIBLE_BOOKS ? rawBook : 'gen'

  const rawChapter = getSingleValue(params.chapter) ?? '1'
  const parsedChapter = Number.parseInt(rawChapter, 10)
  const maxChapter = BIBLE_BOOKS[book].chapters
  const chapter = Number.isNaN(parsedChapter)
    ? 1
    : Math.min(Math.max(parsedChapter, 1), maxChapter)

  const rawVersion = getSingleValue(params.version) ?? 'GAE'
  const version: BibleVersion = isBibleVersion(rawVersion) ? rawVersion : 'GAE'

  return (
    <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }} className="px-4 py-6 pb-20">
      <div className="mx-auto max-w-4xl">
        <BibleViewer
          initialBook={book}
          initialChapter={chapter}
          initialVersion={version}
          bookKeys={BIBLE_BOOK_KEYS}
        />
      </div>
    </main>
  )
}
