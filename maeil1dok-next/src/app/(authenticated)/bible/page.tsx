import { ReadingSettingsProvider } from '@/hooks/bible/ReadingSettingsContext'
import BiblePageClient from '@/components/bible/BiblePageClient'

interface BiblePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function BiblePage({ searchParams }: BiblePageProps) {
  const params = await searchParams
  const initialBook = typeof params.book === 'string' ? params.book : undefined
  const initialChapter = typeof params.chapter === 'string' ? Number.parseInt(params.chapter, 10) || undefined : undefined
  const initialVersion = typeof params.version === 'string' ? params.version : undefined

  return (
    <ReadingSettingsProvider>
      <BiblePageClient
        initialBook={initialBook}
        initialChapter={initialChapter}
        initialVersion={initialVersion}
      />
    </ReadingSettingsProvider>
  )
}
