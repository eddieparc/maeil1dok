'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { BIBLE_BOOKS } from '@/lib/bible/books'
import { cn } from '@/lib/utils'
import { SettingsIcon, ListIcon } from './home/Icons'
import TodayTongdokCard from './home/TodayTongdokCard'
import ContinueReadingCard from './home/ContinueReadingCard'
import WelcomeGuide from './home/WelcomeGuide'
import FeatureCards from './home/FeatureCards'
import UsageTips from './home/UsageTips'
import RecentRecords from './home/RecentRecords'

interface BibleHomeProps {
  lastPosition?: { book: string; chapter: number }
  onContinueReading: (book: string, chapter: number) => void
  onSelectBook: (book: string, chapter: number) => void
  onViewTOC: () => void
}

interface TodaySchedule {
  id: string
  bookCode: string
  bookName: string
  range: string
  startChapter: number
  endChapter: number
  total: number
  completed: number
  isCompleted: boolean
  planId: number
}

interface RecentRecord {
  book: string
  bookName: string
  chapter: number
  readDate: string
}

interface HomeStats {
  bookmarkCount: number
  noteCount: number
  highlightCount: number
  recentRecords: RecentRecord[]
}

function getBookName(bookCode: string): string {
  return BIBLE_BOOKS[bookCode]?.ko ?? bookCode
}

function getChapterUnit(bookCode: string): string {
  return bookCode === 'psa' ? '편' : '장'
}

export default function BibleHome({
  lastPosition,
  onContinueReading,
  onSelectBook,
  onViewTOC,
}: BibleHomeProps) {
  const router = useRouter()

  const [todaySchedule, setTodaySchedule] = useState<TodaySchedule | null>(null)
  const [stats, setStats] = useState<HomeStats>({
    bookmarkCount: 0,
    noteCount: 0,
    highlightCount: 0,
    recentRecords: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [hasPlan, setHasPlan] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const [tipsDismissed, setTipsDismissed] = useState(false)

  const hasBookmarks = stats.bookmarkCount > 0
  const hasNotes = stats.noteCount > 0
  const hasHighlights = stats.highlightCount > 0

  const showWelcomeGuide = useMemo(
    () => !lastPosition && !todaySchedule && stats.recentRecords.length === 0,
    [lastPosition, todaySchedule, stats.recentRecords.length],
  )

  const showUsageTips = useMemo(() => {
    if (tipsDismissed) return false
    const totalActivity = stats.bookmarkCount + stats.noteCount + stats.highlightCount
    return totalActivity < 3 && (!hasBookmarks || !hasNotes || !hasHighlights)
  }, [tipsDismissed, stats.bookmarkCount, stats.noteCount, stats.highlightCount, hasBookmarks, hasNotes, hasHighlights])

  const canDismissTips = stats.bookmarkCount + stats.noteCount + stats.highlightCount > 0

  const loadHomeStats = useCallback(async () => {
    try {
      const [bookmarksRes, notesRes, highlightsRes, recordsRes] = await Promise.all([
        fetch('/api/bible/bookmarks').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/bible/notes').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/bible/highlights').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/bible/personal-records').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])

      const bookmarks = bookmarksRes?.data ?? []
      const notes = notesRes?.data ?? []
      const highlights = highlightsRes?.data ?? []
      const records = (recordsRes?.data ?? []).slice(0, 5)

      setStats({
        bookmarkCount: bookmarks.length,
        noteCount: notes.length,
        highlightCount: highlights.length,
        recentRecords: records.map((r: { book: string; chapter: number; read_date: string }) => ({
          book: r.book,
          bookName: getBookName(r.book),
          chapter: r.chapter,
          readDate: r.read_date,
        })),
      })

      if (!bookmarksRes && !notesRes && !highlightsRes && !recordsRes) {
        setIsAuthenticated(false)
       }
     } catch {
       // Silently fail
     }
   }, [])

  const loadTodaySchedule = useCallback(async () => {
    try {
      const res = await fetch('/api/bible/schedules/today')
      if (res.status === 401) {
        setIsAuthenticated(false)
        return
      }

      if (!res.ok) return

      const result = await res.json()
      const schedules = result.data
      if (!schedules || schedules.length === 0) {
        setHasPlan(false)
        setTodaySchedule(null)
        return
      }

      setHasPlan(true)

      const firstSchedule = schedules[0]
      const completedCount = schedules.filter((s: { is_completed: boolean }) => s.is_completed).length

      const bookCode = firstSchedule.book_code ?? firstSchedule.book ?? ''
      const startCh = firstSchedule.start_chapter ?? firstSchedule.startChapter ?? 1
      const endCh = firstSchedule.end_chapter ?? firstSchedule.endChapter ?? startCh
      const unit = getChapterUnit(bookCode)

      let range = `${startCh}${unit}`
      if (endCh && endCh !== startCh) {
        range = `${startCh}-${endCh}${unit}`
      }

      setTodaySchedule({
        id: firstSchedule.id,
        bookCode,
        bookName: getBookName(bookCode),
        range,
        startChapter: startCh,
        endChapter: endCh,
        total: schedules.length,
        completed: completedCount,
        isCompleted: completedCount === schedules.length,
        planId: firstSchedule.plan_id ?? firstSchedule.planId ?? 0,
      })
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTipsDismissed(localStorage.getItem('bible_tips_dismissed') === 'true')
    }

    setIsLoading(true)
    void Promise.all([loadHomeStats(), loadTodaySchedule()]).finally(() => {
      setIsLoading(false)
    })
  }, [loadHomeStats, loadTodaySchedule])

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleStartTongdok = useCallback(() => {
    if (!todaySchedule) return
    const { bookCode, startChapter, id, planId } = todaySchedule
    router.push(
      `/bible?book=${bookCode}&chapter=${startChapter}&tongdok=true&schedule=${id}&plan=${planId}`,
    )
  }, [todaySchedule, router])

  const dismissTips = useCallback(() => {
    setTipsDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('bible_tips_dismissed', 'true')
    }
  }, [])

  return (
    <div className="min-h-dvh bg-[var(--color-bg-primary)]">
      <header
        className={cn(
          'sticky top-0 z-10 flex items-center justify-between',
          'border-b border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]',
          'px-4 py-3',
        )}
      >
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">성경</h1>
        <button
          type="button"
          className={cn(
            'rounded-lg p-2 text-[var(--color-text-secondary)] transition-all',
            'hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
          )}
          onClick={() => router.push('/bible/settings')}
          aria-label="성경 설정"
        >
          <SettingsIcon />
        </button>
      </header>

      <div className="space-y-6 p-4 pb-8">
        <TodayTongdokCard
          schedule={todaySchedule}
          hasPlan={hasPlan}
          isAuthenticated={isAuthenticated}
          isLoading={isLoading}
          onStart={handleStartTongdok}
          onPlanClick={() => router.push('/plan')}
        />

        {lastPosition && (
          <ContinueReadingCard
            book={lastPosition.book}
            chapter={lastPosition.chapter}
            bookName={getBookName(lastPosition.book)}
            chapterUnit={getChapterUnit(lastPosition.book)}
            onClick={() => onContinueReading(lastPosition.book, lastPosition.chapter)}
          />
        )}

        {showWelcomeGuide && !isLoading && (
          <WelcomeGuide
            isAuthenticated={isAuthenticated}
            onViewTOC={onViewTOC}
            onPlanClick={() => router.push('/plan')}
          />
        )}

        <FeatureCards
          bookmarkCount={stats.bookmarkCount}
          noteCount={stats.noteCount}
          highlightCount={stats.highlightCount}
          onBookmarks={() => router.push('/bible/bookmarks')}
          onNotes={() => router.push('/bible/notes')}
          onHighlights={() => router.push('/bible/highlights')}
          onHistory={() => router.push('/bible/history')}
        />

        {showUsageTips && (
          <UsageTips
            hasBookmarks={hasBookmarks}
            hasNotes={hasNotes}
            hasHighlights={hasHighlights}
            canDismiss={canDismissTips}
            onDismiss={dismissTips}
          />
        )}

        {stats.recentRecords.length > 0 && (
          <RecentRecords
            records={stats.recentRecords}
            onRecordClick={(book, chapter) => onSelectBook(book, chapter)}
          />
        )}

        <section>
          <button
            type="button"
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border-default)]',
              'bg-[var(--color-bg-secondary)] py-3.5 text-[0.9375rem] text-[var(--color-text-primary)]',
              'transition-all hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-tertiary)]',
            )}
            onClick={onViewTOC}
          >
            <ListIcon className="text-[var(--color-accent-primary)]" />
            성경 전체 목차
          </button>
        </section>
      </div>
    </div>
  )
}
