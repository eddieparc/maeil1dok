'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import BibleChapterView from './BibleChapterView'
import ChapterNavigation from './ChapterNavigation'
import { VerseActionMenu } from './VerseActionMenu'
import { useVerseSelection } from './VerseSelector'
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

function stripHtmlTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferVerseNumber(text: string) {
  const match = text.match(/^\s*(\d{1,3})\b/)
  return match ? Number(match[1]) : null
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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | undefined>(undefined)
  const [selectedText, setSelectedText] = useState('')
  const { selectedVerseRange, onVerseClick, clearSelection } = useVerseSelection()

  const maxChapter = useMemo(() => {
    return BIBLE_BOOKS[currentBook]?.chapters ?? 1
  }, [currentBook])

  const chapterText = useMemo(() => stripHtmlTags(content), [content])

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

  const resetSelectionAndMenu = () => {
    clearSelection()
    setSelectedText('')
    setMenuPosition(undefined)
    setIsMenuOpen(false)
  }

  const handleBookChange = (nextBook: string) => {
    resetSelectionAndMenu()
    setCurrentBook(nextBook)
    setCurrentChapter(1)
  }

  const handleChapterChange = (nextChapter: number) => {
    resetSelectionAndMenu()
    setCurrentChapter(Math.min(Math.max(nextChapter, 1), maxChapter))
  }

  const handlePrevChapter = () => {
    resetSelectionAndMenu()
    setCurrentChapter((prev) => Math.max(prev - 1, 1))
  }

  const handleNextChapter = () => {
    resetSelectionAndMenu()
    setCurrentChapter((prev) => Math.min(prev + 1, maxChapter))
  }

  const handleVersionChange = (nextVersion: BibleVersion) => {
    resetSelectionAndMenu()
    setCurrentVersion(nextVersion)
  }

  const openMenuWithChapter = () => {
    setSelectedText(chapterText)
    setMenuPosition(undefined)
    setIsMenuOpen(true)
  }

  const handleVerseTap = (payload: { text: string; position?: { x: number; y: number } }) => {
    const verseNumber = inferVerseNumber(payload.text)

    if (verseNumber !== null) {
      onVerseClick(verseNumber)
    } else {
      clearSelection()
    }

    setSelectedText(payload.text || chapterText)
    setMenuPosition(payload.position)
    setIsMenuOpen(true)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
    setMenuPosition(undefined)
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
        <VersionSelector version={currentVersion} onVersionChange={handleVersionChange} />
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

      <BibleChapterView content={content} isLoading={isLoading} onVerseTap={handleVerseTap} />

      <button
        type="button"
        className="fixed bottom-24 right-4 z-30 rounded-full bg-blue-500 p-3 text-white shadow-lg transition hover:bg-blue-600"
        onClick={openMenuWithChapter}
        aria-label="본문 작업 메뉴 열기"
      >
        📋
      </button>

      {selectedVerseRange ? (
        <div className="fixed bottom-24 left-4 z-20 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">
          선택 {selectedVerseRange.start}절
        </div>
      ) : null}

      {isMenuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/0"
            aria-label="본문 작업 메뉴 닫기"
            onClick={closeMenu}
          />
          <VerseActionMenu
            book={currentBook}
            chapter={currentChapter}
            version={currentVersion}
            verseText={selectedText || chapterText}
            position={menuPosition}
            onClose={closeMenu}
          />
        </>
      ) : null}
    </div>
  )
}
