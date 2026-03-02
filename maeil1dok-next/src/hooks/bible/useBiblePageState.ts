import { useMemo, useState } from 'react'

import {
  BIBLE_BOOKS,
  BIBLE_BOOK_ORDER,
  BIBLE_VERSIONS,
  isBibleVersion,
  type BibleVersion,
} from '@/lib/bible/books'
import type { ChapterSuffix, ViewMode } from '@/types/bible'

interface UseBiblePageStateReturn {
  viewMode: ViewMode
  currentBook: string
  currentChapter: number
  currentVersion: BibleVersion

  currentBookName: string
  currentVersionName: string
  maxChapters: number
  chapterSuffix: ChapterSuffix
  hasPrevChapter: boolean
  hasNextChapter: boolean

  setViewMode: (mode: ViewMode) => void
  goToPrevChapter: () => void
  goToNextChapter: () => void
  selectBook: (book: string) => void
  selectChapter: (chapter: number) => void
  selectVersion: (version: BibleVersion) => void
  initFromQuery: (params: Record<string, string>) => void
  generateShareUrl: () => string
}

const DEFAULT_BOOK = 'gen'
const DEFAULT_CHAPTER = 1
const DEFAULT_VERSION: BibleVersion = 'GAE'
const DEFAULT_VIEW_MODE: ViewMode = 'home'
const BOOK_ORDER: readonly string[] = BIBLE_BOOK_ORDER

function isValidBook(book: string): book is keyof typeof BIBLE_BOOKS {
  return book in BIBLE_BOOKS
}

export function useBiblePageState(): UseBiblePageStateReturn {
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_VIEW_MODE)
  const [currentBook, setCurrentBook] = useState<string>(DEFAULT_BOOK)
  const [currentChapter, setCurrentChapter] = useState<number>(DEFAULT_CHAPTER)
  const [currentVersion, setCurrentVersion] = useState<BibleVersion>(DEFAULT_VERSION)

  const maxChapters = useMemo(() => BIBLE_BOOKS[currentBook]?.chapters ?? 1, [currentBook])
  const currentBookName = useMemo(() => BIBLE_BOOKS[currentBook]?.ko ?? currentBook, [currentBook])
  const currentVersionName = useMemo(
    () => BIBLE_VERSIONS[currentVersion] ?? currentVersion,
    [currentVersion],
  )
  const chapterSuffix = useMemo<ChapterSuffix>(() => (currentBook === 'psa' ? '편' : '장'), [currentBook])

  const hasPrevChapter = useMemo(() => {
    if (currentChapter > 1) {
      return true
    }

    return BOOK_ORDER.indexOf(currentBook) > 0
  }, [currentBook, currentChapter])

  const hasNextChapter = useMemo(() => {
    if (currentChapter < maxChapters) {
      return true
    }

    const currentIndex = BOOK_ORDER.indexOf(currentBook)
    return currentIndex > -1 && currentIndex < BOOK_ORDER.length - 1
  }, [currentBook, currentChapter, maxChapters])

  const goToPrevChapter = () => {
    if (currentChapter > 1) {
      setCurrentChapter((prev) => prev - 1)
      return
    }

    const currentIndex = BOOK_ORDER.indexOf(currentBook)
    if (currentIndex <= 0) {
      return
    }

    const prevBook = BOOK_ORDER[currentIndex - 1]
    if (!prevBook || !isValidBook(prevBook)) {
      return
    }

    setCurrentBook(prevBook)
    setCurrentChapter(BIBLE_BOOKS[prevBook].chapters)
  }

  const goToNextChapter = () => {
    if (currentChapter < maxChapters) {
      setCurrentChapter((prev) => prev + 1)
      return
    }

    const currentIndex = BOOK_ORDER.indexOf(currentBook)
    if (currentIndex < 0 || currentIndex >= BOOK_ORDER.length - 1) {
      return
    }

    const nextBook = BOOK_ORDER[currentIndex + 1]
    if (!nextBook || !isValidBook(nextBook)) {
      return
    }

    setCurrentBook(nextBook)
    setCurrentChapter(1)
  }

  const selectBook = (book: string) => {
    if (!isValidBook(book)) {
      return
    }

    setCurrentBook(book)
    setCurrentChapter((prev) => Math.min(Math.max(prev, 1), BIBLE_BOOKS[book].chapters))
  }

  const selectChapter = (chapter: number) => {
    if (!Number.isInteger(chapter) || chapter < 1) {
      return
    }

    setCurrentChapter(Math.min(chapter, maxChapters))
  }

  const selectVersion = (version: BibleVersion) => {
    setCurrentVersion(version)
  }

  const initFromQuery = (params: Record<string, string>) => {
    const nextBook = params.book
    const nextChapter = params.chapter
    const nextVersion = params.version

    if (nextBook && isValidBook(nextBook)) {
      setCurrentBook(nextBook)

      if (nextChapter) {
        const chapterNum = Number.parseInt(nextChapter, 10)
        if (Number.isInteger(chapterNum) && chapterNum > 0) {
          const nextMaxChapters = BIBLE_BOOKS[nextBook].chapters
          setCurrentChapter(Math.min(chapterNum, nextMaxChapters))
        }
      }
    } else if (nextChapter) {
      const chapterNum = Number.parseInt(nextChapter, 10)
      if (Number.isInteger(chapterNum) && chapterNum > 0) {
        setCurrentChapter(Math.min(chapterNum, maxChapters))
      }
    }

    if (nextVersion && isBibleVersion(nextVersion)) {
      setCurrentVersion(nextVersion)
    }
  }

  const generateShareUrl = () => {
    return `/bible?book=${currentBook}&chapter=${currentChapter}&version=${currentVersion}`
  }

  return {
    viewMode,
    currentBook,
    currentChapter,
    currentVersion,
    currentBookName,
    currentVersionName,
    maxChapters,
    chapterSuffix,
    hasPrevChapter,
    hasNextChapter,
    setViewMode,
    goToPrevChapter,
    goToNextChapter,
    selectBook,
    selectChapter,
    selectVersion,
    initFromQuery,
    generateShareUrl,
  }
}

export type { UseBiblePageStateReturn }
