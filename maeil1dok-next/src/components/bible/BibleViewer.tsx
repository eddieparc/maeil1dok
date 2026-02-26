'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import BibleChapterView from './BibleChapterView'
import ChapterNavigation from './ChapterNavigation'
import VersionSelector from './VersionSelector'
import { BIBLE_BOOKS, type BibleVersion } from '@/lib/bible/books'

interface BibleViewerProps {
  initialBook: string
  initialChapter: number
  initialVersion: BibleVersion
  bookKeys: string[]
}

function getProxyPrefix(version: BibleVersion): 'KNT' | 'bible' {
  return version === 'KNT' ? 'KNT' : 'bible'
}

export default function BibleViewer({
  initialBook,
  initialChapter,
  initialVersion,
  bookKeys,
}: BibleViewerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [currentBook, setCurrentBook] = useState(initialBook)
  const [currentChapter, setCurrentChapter] = useState(initialChapter)
  const [currentVersion, setCurrentVersion] = useState<BibleVersion>(initialVersion)
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const maxChapter = useMemo(() => {
    return BIBLE_BOOKS[currentBook]?.chapters ?? 1
  }, [currentBook])

  useEffect(() => {
    if (currentChapter > maxChapter) {
      setCurrentChapter(maxChapter)
    }
  }, [currentChapter, maxChapter])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const nextBook = params.get('book')
    const nextChapter = params.get('chapter')
    const nextVersion = params.get('version')

    if (
      nextBook === currentBook
      && nextChapter === String(currentChapter)
      && nextVersion === currentVersion
    ) {
      return
    }

    params.set('book', currentBook)
    params.set('chapter', String(currentChapter))
    params.set('version', currentVersion)
    router.push(`${pathname}?${params.toString()}`)
  }, [currentBook, currentChapter, currentVersion, pathname, router, searchParams])

  useEffect(() => {
    const controller = new AbortController()
    const prefix = getProxyPrefix(currentVersion)
    const url = `/api/bible-proxy/${prefix}/korbibReadpage.php?version=${currentVersion}&book=${currentBook}&chap=${currentChapter}`

    async function fetchContent() {
      try {
        setIsLoading(true)
        const response = await fetch(url, { signal: controller.signal })
        const html = await response.text()
        setContent(html)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setContent('<p>성경 본문을 불러오지 못했습니다.</p>')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchContent()

    return () => controller.abort()
  }, [currentBook, currentChapter, currentVersion])

  const handleBookChange = (nextBook: string) => {
    setCurrentBook(nextBook)
    setCurrentChapter(1)
  }

  const handleChapterChange = (nextChapter: number) => {
    setCurrentChapter(Math.min(Math.max(nextChapter, 1), maxChapter))
  }

  const handlePrevChapter = () => {
    setCurrentChapter((prev) => Math.max(prev - 1, 1))
  }

  const handleNextChapter = () => {
    setCurrentChapter((prev) => Math.min(prev + 1, maxChapter))
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-gray-900">
            {BIBLE_BOOKS[currentBook]?.ko ?? currentBook} {currentChapter}장
          </h1>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {currentVersion}
          </span>
        </div>
        <VersionSelector version={currentVersion} onVersionChange={setCurrentVersion} />
      </section>

      <ChapterNavigation
        book={currentBook}
        chapter={currentChapter}
        bookKeys={bookKeys}
        onBookChange={handleBookChange}
        onChapterChange={handleChapterChange}
        onPrevChapter={handlePrevChapter}
        onNextChapter={handleNextChapter}
      />

      <BibleChapterView content={content} isLoading={isLoading} />
    </div>
  )
}
