'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { BIBLE_BOOKS } from '@/lib/bible/books'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Icons (inline SVGs) ─────────────────────────────────────────────────────

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-[18px] w-[18px]', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function HighlightIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  )
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
    </svg>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBookName(bookCode: string): string {
  return BIBLE_BOOKS[bookCode]?.ko ?? bookCode
}

function getChapterUnit(bookCode: string): string {
  return bookCode === 'psa' ? '편' : '장'
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7) return `${diff}일 전`

  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatTodayDate(): string {
  const today = new Date()
  return today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

// ─── Component ───────────────────────────────────────────────────────────────

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

  // ─── Data fetching ──────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTipsDismissed(localStorage.getItem('bible_tips_dismissed') === 'true')
    }

    void loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    await Promise.all([loadHomeStats(), loadTodaySchedule()])
    setIsLoading(false)
  }

  async function loadHomeStats() {
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
    } catch {
      // Silently fail - stats will remain at defaults
    }
  }

  async function loadTodaySchedule() {
    try {
      const res = await fetch('/api/bible/schedules/today')
      if (!res.ok) return

      const result = await res.json()
      const schedules = result.data
      if (!schedules || schedules.length === 0) return

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
  }

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleStartTongdok = useCallback(() => {
    if (!todaySchedule) return
    const { bookCode, startChapter, id, planId } = todaySchedule
    router.push(
      `/bible?book=${bookCode}&chapter=${startChapter}&tongdok=true&schedule=${id}&plan=${planId}`,
    )
  }, [todaySchedule, router])

  const handleRecordClick = useCallback(
    (record: RecentRecord) => {
      onSelectBook(record.book, record.chapter)
    },
    [onSelectBook],
  )

  const dismissTips = useCallback(() => {
    setTipsDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('bible_tips_dismissed', 'true')
    }
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-[var(--color-bg-primary)]">
      {/* Header */}
      <header
        className={cn(
          'sticky top-0 z-10 flex items-center justify-between',
          'border-b border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]',
          'px-4 py-3',
        )}
      >
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">성경</h1>
      </header>

      <div className="space-y-6 p-4 pb-8">
        {/* ── Today's Reading Card ─────────────────────────────────────── */}
        {todaySchedule && (
          <section>
            <div
              className={cn(
                'rounded-2xl p-5 text-white shadow-lg',
                'bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-hover)]',
              )}
            >
              {/* Card header */}
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                  오늘의 통독
                </span>
                <span className="text-[0.8125rem] opacity-90">{formatTodayDate()}</span>
              </div>

              {/* Schedule info */}
              <div className="mb-4">
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="text-xl font-bold">{todaySchedule.bookName}</span>
                  <span className="text-base opacity-90">{todaySchedule.range}</span>
                </div>

                {/* Progress indicator */}
                {todaySchedule.total > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="whitespace-nowrap text-xs opacity-90">
                      {todaySchedule.completed}/{todaySchedule.total} 완료
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/30">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-300"
                        style={{
                          width: `${(todaySchedule.completed / todaySchedule.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Start button */}
              <button
                type="button"
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[0.9375rem] font-semibold transition-all',
                  todaySchedule.isCompleted
                    ? 'bg-white/20 text-white'
                    : 'bg-white text-[var(--color-accent-primary)] hover:-translate-y-0.5 hover:shadow-lg',
                )}
                onClick={handleStartTongdok}
              >
                {todaySchedule.isCompleted ? (
                  <>
                    <CheckCircleIcon />
                    <span>완료됨</span>
                  </>
                ) : (
                  <>
                    <PlayIcon />
                    <span>통독 시작</span>
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {/* ── Continue Reading ─────────────────────────────────────────── */}
        {lastPosition && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
              계속 읽기
            </h2>
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-xl border border-[var(--color-border-default)]',
                'bg-[var(--color-bg-secondary)] px-5 py-4 text-[var(--color-text-primary)]',
                'transition-all hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-tertiary)]',
              )}
              onClick={() => onContinueReading(lastPosition.book, lastPosition.chapter)}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {BIBLE_BOOKS[lastPosition.book]?.ko ?? lastPosition.book}
                </span>
                <span className="text-[0.9375rem] text-[var(--color-text-secondary)]">
                  {lastPosition.chapter}
                  {getChapterUnit(lastPosition.book)}
                </span>
              </div>
              <ArrowRightIcon className="text-[var(--color-text-muted)]" />
            </button>
          </section>
        )}

        {/* ── Welcome Guide ────────────────────────────────────────────── */}
        {showWelcomeGuide && !isLoading && (
          <section>
            <div
              className={cn(
                'rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]',
                'px-6 py-8 text-center',
              )}
            >
              <div className="mb-4 text-5xl">📖</div>
              <h2 className="mb-2 text-lg font-bold text-[var(--color-text-primary)]">
                매일일독에 오신 것을 환영합니다!
              </h2>
              <p className="mb-6 text-[0.9375rem] text-[var(--color-text-secondary)]">
                성경을 읽고, 묵상하고, 기록해보세요.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl px-4 py-3.5',
                    'bg-[var(--color-accent-primary)] text-[0.9375rem] font-medium text-white',
                    'transition-all hover:bg-[var(--color-accent-hover)]',
                  )}
                  onClick={onViewTOC}
                >
                  <ListIcon className="h-[18px] w-[18px]" />
                  성경 목차에서 시작하기
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Feature Cards ────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
            내 성경 활동
          </h2>
          <div className="flex flex-col gap-2">
            <FeatureCard
              icon={<BookmarkIcon />}
              iconBg="bg-[var(--color-warning-bg)]"
              iconColor="text-[var(--color-warning-text)]"
              name="북마크"
              count={stats.bookmarkCount}
              description={
                stats.bookmarkCount > 0
                  ? `저장된 ${stats.bookmarkCount}개의 장`
                  : '자주 찾는 장을 저장하세요'
              }
              onClick={() => router.push('/bible/bookmarks')}
            />
            <FeatureCard
              icon={<DocumentIcon />}
              iconBg="bg-[var(--color-info-bg)]"
              iconColor="text-[var(--color-info-text)]"
              name="묵상노트"
              count={stats.noteCount}
              description={
                stats.noteCount > 0
                  ? `작성된 ${stats.noteCount}개의 노트`
                  : '말씀을 읽고 묵상을 기록하세요'
              }
              onClick={() => router.push('/bible/notes')}
            />
            <FeatureCard
              icon={<HighlightIcon />}
              iconBg="bg-[var(--color-danger-bg)]"
              iconColor="text-[var(--color-danger-text)]"
              name="하이라이트"
              count={stats.highlightCount}
              description={
                stats.highlightCount > 0
                  ? `표시된 ${stats.highlightCount}개의 구절`
                  : '중요한 구절에 색상을 입히세요'
              }
              onClick={() => router.push('/bible/highlights')}
            />
            <FeatureCard
              icon={<HistoryIcon />}
              iconBg="bg-[var(--color-success-bg)]"
              iconColor="text-[var(--color-success-text)]"
              name="읽기 기록"
              description="읽은 장과 날짜를 확인하세요"
              onClick={() => router.push('/bible/history')}
            />
          </div>
        </section>

        {/* ── Usage Tips ───────────────────────────────────────────────── */}
        {showUsageTips && (
          <section
            className={cn(
              'rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-4',
            )}
          >
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
              💡 사용 팁
            </h2>
            <div className="flex flex-col gap-3.5">
              {!hasHighlights && (
                <TipItem
                  emoji="✨"
                  title="하이라이트 만들기"
                  description={
                    <>
                      성경 본문에서 텍스트를{' '}
                      <em className="not-italic font-medium text-[var(--color-accent-primary)]">
                        드래그
                      </em>
                      하면 하이라이트, 복사, 공유 메뉴가 나타나요
                    </>
                  }
                />
              )}
              {!hasBookmarks && (
                <TipItem
                  emoji="🔖"
                  title="북마크 추가하기"
                  description={
                    <>
                      성경 읽기 화면 상단의{' '}
                      <em className="not-italic font-medium text-[var(--color-accent-primary)]">
                        북마크 아이콘
                      </em>
                      을 눌러 현재 장을 저장하세요
                    </>
                  }
                />
              )}
              {!hasNotes && (
                <TipItem
                  emoji="📝"
                  title="묵상노트 작성하기"
                  description={
                    <>
                      읽기 화면의{' '}
                      <em className="not-italic font-medium text-[var(--color-accent-primary)]">
                        메뉴(⋮)
                      </em>
                      에서 묵상노트를 작성할 수 있어요
                    </>
                  }
                />
              )}
            </div>
            {canDismissTips && (
              <button
                type="button"
                className={cn(
                  'mt-3 block w-full text-center text-xs text-[var(--color-text-muted)]',
                  'transition-colors hover:text-[var(--color-text-secondary)]',
                )}
                onClick={dismissTips}
              >
                다음부터 표시 안함
              </button>
            )}
          </section>
        )}

        {/* ── Recent Records ───────────────────────────────────────────── */}
        {stats.recentRecords.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
              최근 읽은 성경
            </h2>
            <ul
              className={cn(
                'overflow-hidden rounded-xl border border-[var(--color-border-default)]',
                'bg-[var(--color-bg-secondary)]',
              )}
            >
              {stats.recentRecords.map((record) => (
                <li
                  key={`${record.book}-${record.chapter}-${record.readDate}`}
                  className={cn(
                    'flex cursor-pointer items-center justify-between px-4 py-3.5',
                    'border-b border-[var(--color-border-default)] last:border-b-0',
                    'transition-colors hover:bg-[var(--color-bg-tertiary)]',
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRecordClick(record)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleRecordClick(record)
                    }
                  }}
                >
                  <span className="text-[0.9375rem] text-[var(--color-text-primary)]">
                    {record.bookName} {record.chapter}
                    {getChapterUnit(record.book)}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {formatDate(record.readDate)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── TOC Shortcut ─────────────────────────────────────────────── */}
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

// ─── Sub-components ────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  name: string
  count?: number
  description: string
  onClick: () => void
}

function FeatureCard({ icon, iconBg, iconColor, name, count, description, onClick }: FeatureCardProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3.5 rounded-xl border border-[var(--color-border-default)]',
        'bg-[var(--color-bg-secondary)] p-4 text-left',
        'transition-all hover:border-[var(--color-border-dark)] hover:bg-[var(--color-bg-tertiary)]',
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          iconBg,
          iconColor,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-[0.9375rem] font-semibold text-[var(--color-text-primary)]">
            {name}
          </span>
          {count != null && count > 0 && (
            <span
              className={cn(
                'rounded-lg bg-[var(--color-accent-light)] px-2 py-0.5',
                'text-xs font-semibold text-[var(--color-accent-primary)]',
              )}
            >
              {count}
            </span>
          )}
        </div>
        <p className="truncate text-[0.8125rem] text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>
      <ArrowRightIcon className="shrink-0 text-[var(--color-text-muted)]" />
    </button>
  )
}

interface TipItemProps {
  emoji: string
  title: string
  description: React.ReactNode
}

function TipItem({ emoji, title, description }: TipItemProps) {
  return (
    <div className="flex gap-3 rounded-lg bg-[var(--color-bg-tertiary)] p-3">
      <span className="shrink-0 text-xl">{emoji}</span>
      <div>
        <strong className="mb-1 block text-sm text-[var(--color-text-primary)]">{title}</strong>
        <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>
    </div>
  )
}
