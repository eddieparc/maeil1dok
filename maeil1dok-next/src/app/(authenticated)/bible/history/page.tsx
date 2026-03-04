'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Star,
} from 'lucide-react'
import { BIBLE_BOOKS, BIBLE_BOOK_ORDER } from '@/lib/bible/books'

interface PersonalRecord {
  book: string
  chapter: number
  read_date: string
}

interface StatsPayload {
  total_chapters_read: number
  books_completed: number
  current_streak: number
  books_progress: Record<string, { read: number }>
}

interface BookItem {
  id: string
  name: string
  testament: 'old' | 'new'
  read: number
  total: number
}

type FilterKey = 'all' | 'old' | 'new'

const TOTAL_CHAPTERS = BIBLE_BOOK_ORDER.reduce((sum, key) => sum + (BIBLE_BOOKS[key]?.chapters ?? 0), 0)
const OT_BOOKS = new Set(BIBLE_BOOK_ORDER.slice(0, 39))

function formatDateLabel(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function computeCurrentStreak(dates: string[]): number {
  const readingSet = new Set(dates)
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  let streak = 0
  while (true) {
    const iso = cursor.toISOString().split('T')[0]
    if (!readingSet.has(iso)) {
      break
    }
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function ReadingCalendar({ readingDates }: { readingDates: string[] }) {
  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const readingSet = useMemo(() => new Set(readingDates), [readingDates])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const prevMonthLast = new Date(currentYear, currentMonth, 0)

    const days: Array<{
      day: number
      isCurrentMonth: boolean
      hasReading: boolean
      isToday: boolean
      dayOfWeek: number
    }> = []

    const prevOffset = firstDay.getDay()
    for (let i = prevOffset - 1; i >= 0; i -= 1) {
      const day = prevMonthLast.getDate() - i
      const date = new Date(currentYear, currentMonth - 1, day)
      const iso = date.toISOString().split('T')[0]
      days.push({
        day,
        isCurrentMonth: false,
        hasReading: readingSet.has(iso),
        isToday: false,
        dayOfWeek: date.getDay(),
      })
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(currentYear, currentMonth, day)
      const iso = date.toISOString().split('T')[0]
      days.push({
        day,
        isCurrentMonth: true,
        hasReading: readingSet.has(iso),
        isToday: date.toDateString() === today.toDateString(),
        dayOfWeek: date.getDay(),
      })
    }

    const remaining = 42 - days.length
    for (let day = 1; day <= remaining; day += 1) {
      const date = new Date(currentYear, currentMonth + 1, day)
      const iso = date.toISOString().split('T')[0]
      days.push({
        day,
        isCurrentMonth: false,
        hasReading: readingSet.has(iso),
        isToday: false,
        dayOfWeek: date.getDay(),
      })
    }

    return days
  }, [currentMonth, currentYear, readingSet, today])

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
          onClick={() => {
            if (currentMonth === 0) {
              setCurrentMonth(11)
              setCurrentYear((prev) => prev - 1)
              return
            }
            setCurrentMonth((prev) => prev - 1)
          }}
          aria-label="이전 달"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="text-base font-semibold text-[var(--color-text-primary)]">
          {currentYear}년 {currentMonth + 1}월
        </span>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
          onClick={() => {
            if (currentMonth === 11) {
              setCurrentMonth(0)
              setCurrentYear((prev) => prev + 1)
              return
            }
            setCurrentMonth((prev) => prev + 1)
          }}
          aria-label="다음 달"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7">
              {['일', '월', '화', '수', '목', '금', '토'].map((weekday) => (
          <span
            key={weekday}
            className={[
              'py-1 text-center text-xs font-medium',
              weekday === '일' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]',
            ].join(' ')}
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[2px]">
        {calendarDays.map((date, index) => (
          <div
            key={`${date.day}-${index}`}
            className={[
              'relative flex aspect-square flex-col items-center justify-center rounded-lg',
              !date.isCurrentMonth ? 'opacity-30' : '',
              date.hasReading ? 'bg-[var(--color-success-bg)]' : '',
              date.isToday ? 'ring-1 ring-[var(--primary-color,var(--color-accent-primary))]' : '',
            ].join(' ')}
          >
            <span
              className={[
                'text-[0.8125rem] text-[var(--color-text-primary)]',
                date.dayOfWeek === 0 ? 'text-[var(--color-danger)]' : '',
                date.isToday ? 'font-semibold text-[var(--primary-color,var(--color-accent-primary))]' : '',
              ].join(' ')}
            >
              {date.day}
            </span>
            {date.hasReading ? (
              <span
                className="absolute bottom-1 h-[5px] w-[5px] rounded-full bg-[var(--color-success)]"
                aria-hidden="true"
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-center border-t border-[var(--color-border)] pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
          읽음
        </span>
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const [records, setRecords] = useState<PersonalRecord[]>([])
  const [stats, setStats] = useState<StatsPayload>({
    total_chapters_read: 0,
    books_completed: 0,
    current_streak: 0,
    books_progress: {},
  })
  const [readingDates, setReadingDates] = useState<string[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadHistory() {
      try {
        const [statsRes, datesRes, recordsRes] = await Promise.allSettled([
          fetch('/api/bible/personal-records/stats'),
          fetch('/api/bible/personal-records/dates'),
          fetch('/api/bible/personal-records'),
        ])

        const recordResponse = recordsRes.status === 'fulfilled' ? recordsRes.value : null
        if (recordResponse?.status === 401) {
          if (!isMounted) return
          setIsAuthenticated(false)
          setRecords([])
          setStats({ total_chapters_read: 0, books_completed: 0, current_streak: 0, books_progress: {} })
          setReadingDates([])
          return
        }

        if (!recordResponse?.ok) {
          if (!isMounted) return
          setRecords([])
          setStats({ total_chapters_read: 0, books_completed: 0, current_streak: 0, books_progress: {} })
          setReadingDates([])
          return
        }

        const recordsJson = (await recordResponse.json()) as { data?: PersonalRecord[] }
        const loadedRecords = recordsJson.data ?? []

        if (!isMounted) return
        setRecords(loadedRecords)

        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          const json = (await statsRes.value.json()) as { stats?: StatsPayload }
          if (json.stats) {
            setStats(json.stats)
          }
        }

        if (datesRes.status === 'fulfilled' && datesRes.value.ok) {
          const json = (await datesRes.value.json()) as { dates?: string[] }
          if (Array.isArray(json.dates)) {
            setReadingDates(json.dates)
          }
        }

        const grouped = loadedRecords.reduce<Record<string, Set<number>>>((acc, record) => {
          if (!acc[record.book]) acc[record.book] = new Set<number>()
          acc[record.book].add(record.chapter)
          return acc
        }, {})

        const booksProgress = Object.entries(grouped).reduce<Record<string, { read: number }>>(
          (acc, [book, chapters]) => {
            acc[book] = { read: chapters.size }
            return acc
          },
          {},
        )

        const uniqueDates = Array.from(new Set(loadedRecords.map((item) => item.read_date))).sort()
        const totalRead = Object.values(booksProgress).reduce((sum, item) => sum + item.read, 0)
        const completedBooks = Object.entries(booksProgress).filter(
          ([book, progress]) => progress.read >= (BIBLE_BOOKS[book]?.chapters ?? 0),
        ).length

        setReadingDates((prev) => (prev.length > 0 ? prev : uniqueDates))
        setStats((prev) => {
          if (prev.total_chapters_read > 0 || prev.books_completed > 0 || prev.current_streak > 0) {
            return prev
          }
          return {
            total_chapters_read: totalRead,
            books_completed: completedBooks,
            current_streak: computeCurrentStreak(uniqueDates),
            books_progress: booksProgress,
          }
        })
      } catch {
        if (!isMounted) return
        setRecords([])
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      isMounted = false
    }
  }, [])

  const tabs = useMemo(
    () => [
      { href: '/bible/bookmarks', label: '북마크', current: false },
      { href: '/bible/notes', label: '노트', current: false },
      { href: '/bible/highlights', label: '하이라이트', current: false },
      { href: '/bible/history', label: '기록', current: true },
    ],
    [],
  )

  const booksWithProgress = useMemo<BookItem[]>(() => {
    return BIBLE_BOOK_ORDER.map((id) => ({
      id,
      name: BIBLE_BOOKS[id]?.ko ?? id,
      testament: OT_BOOKS.has(id) ? 'old' : 'new',
      read: stats.books_progress[id]?.read ?? 0,
      total: BIBLE_BOOKS[id]?.chapters ?? 0,
    }))
  }, [stats.books_progress])

  const filteredBooks = useMemo(() => {
    if (filter === 'all') return booksWithProgress
    return booksWithProgress.filter((book) => book.testament === filter)
  }, [booksWithProgress, filter])

  const progressPercent = TOTAL_CHAPTERS > 0 ? (stats.total_chapters_read / TOTAL_CHAPTERS) * 100 : 0

  const recentRecords = useMemo(() => {
    return [...records]
      .sort((a, b) => (a.read_date < b.read_date ? 1 : -1))
      .slice(0, 12)
  }, [records])

  return (
    <main className="min-h-dvh bg-[var(--color-bg-primary)] pb-24">
      <div className="mx-auto min-h-dvh max-w-[768px] bg-[var(--color-bg-primary)]">
        <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link
              href="/bible"
              className="-m-2 rounded-lg p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
              aria-label="뒤로 가기"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </Link>
            <h1 className="flex-1 text-lg font-semibold text-[var(--color-text-primary)]">읽기 기록</h1>
          </div>
          <div className="border-t border-[var(--color-border)] px-2 py-1">
            <nav className="flex items-center gap-1 overflow-x-auto px-2" aria-label="성경 활동 네비게이션">
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    tab.current
                      ? 'bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
                  ].join(' ')}
                  aria-current={tab.current ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <div className="space-y-6 px-4 py-4">
          {isLoading ? (
            <section className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-[var(--color-text-secondary)]">
              <Loader2 size={28} className="animate-spin" aria-hidden="true" />
              <p className="text-sm">읽기 기록을 불러오는 중...</p>
            </section>
          ) : !isAuthenticated ? (
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-6 py-10 text-center">
              <p className="text-[0.9375rem] text-[var(--color-text-secondary)]">로그인 후 읽기 기록을 확인할 수 있습니다</p>
              <Link
                href="/login"
                className="mt-4 inline-flex rounded-lg bg-[var(--primary-color,var(--color-accent-primary))] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
              >
                로그인
              </Link>
            </section>
          ) : (
            <>
              <section className="grid grid-cols-3 gap-3">
                <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-primary-light)] text-[var(--primary-color,var(--color-accent-primary))]">
                    <BookOpen size={20} aria-hidden="true" />
                  </div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">
                    {stats.total_chapters_read} / {TOTAL_CHAPTERS}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">전체 진도</p>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary-color,var(--color-accent-primary))]"
                      style={{ width: `${Math.min(progressPercent, 100)}%` }}
                    />
                  </div>
                </article>

                <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
                    <Star size={20} aria-hidden="true" />
                  </div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{stats.current_streak}일</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">연속 읽기</p>
                </article>

                <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
                    <Check size={20} aria-hidden="true" />
                  </div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{stats.books_completed} / 66권</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">완독</p>
                </article>
              </section>

              <section>
                <h2 className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">읽기 캘린더</h2>
                <ReadingCalendar readingDates={readingDates} />
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">책별 진도</h2>
                  <div className="flex items-center gap-2">
                    {([
                      { key: 'all', label: '전체' },
                      { key: 'old', label: '구약' },
                      { key: 'new', label: '신약' },
                    ] as const).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={[
                          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          filter === tab.key
                            ? 'border-[var(--primary-color,var(--color-accent-primary))] bg-[var(--primary-color,var(--color-accent-primary))] text-white'
                            : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
                        ].join(' ')}
                        onClick={() => setFilter(tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                  {filteredBooks.map((book) => {
                    const isCompleted = book.total > 0 && book.read >= book.total
                    const chapterProgress = book.total > 0 ? (book.read / book.total) * 100 : 0

                    return (
                      <Link
                        key={book.id}
                        href={`/bible?book=${book.id}&chapter=1`}
                        className={[
                          'rounded-lg border p-3 transition-all hover:-translate-y-[2px] hover:shadow-[var(--shadow-md)]',
                          isCompleted
                            ? 'border-[var(--color-success)] bg-[var(--color-success-bg)]'
                            : 'border-[var(--color-border)] bg-[var(--color-bg-card)]',
                        ].join(' ')}
                      >
                        <p className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">{book.name}</p>
                        <p className="mb-1 text-xs text-[var(--color-text-muted)]">
                          {book.read} / {book.total}장
                        </p>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
                          <div
                            className="h-full rounded-full bg-[var(--color-success)]"
                            style={{ width: `${Math.min(chapterProgress, 100)}%` }}
                          />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">최근 읽기 기록</h2>
                {recentRecords.length === 0 ? (
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                    아직 읽은 기록이 없어요
                  </div>
                ) : (
                  <ul className="m-0 list-none overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-0">
                    {recentRecords.map((record, index) => (
                      <li
                        key={`${record.book}-${record.chapter}-${record.read_date}-${index}`}
                        className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                            {BIBLE_BOOKS[record.book]?.ko ?? record.book} {record.chapter}장
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">{formatDateLabel(record.read_date)}</p>
                        </div>
                        <span className="inline-flex shrink-0 rounded-full bg-[var(--color-success-bg)] px-2 py-1 text-xs font-medium text-[var(--color-success)]">
                          완료
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
