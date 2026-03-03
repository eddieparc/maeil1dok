'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BIBLE_BOOKS } from '@/lib/bible/books'

// ── Types ────────────────────────────────────────────────────────────────

interface TodaySchedule {
  id: number
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
  bookmarks: number
  notes: number
  highlights: number
  recentRecords: RecentRecord[]
}

interface BibleHomeProps {
  lastPosition?: { book: string; chapter: number }
  onContinueReading: (book: string, chapter: number) => void
  onViewTOC: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getBookName(bookCode: string): string {
  return BIBLE_BOOKS[bookCode]?.ko ?? bookCode
}

function getChapterUnit(bookCode: string): string {
  return bookCode === 'psa' ? '편' : '장'
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const diff = Math.floor(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7) return `${diff}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

// ── SVG Icons (inline) ──────────────────────────────────────────────────

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  )
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function HighlightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
    </svg>
  )
}

// ── Feature card config ─────────────────────────────────────────────────

interface FeatureCardDef {
  key: string
  name: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  emptyText: string
  countText: (n: number) => string
  countKey: keyof HomeStats
}

const FEATURE_CARDS: FeatureCardDef[] = [
  {
    key: 'bookmarks',
    name: '북마크',
    icon: <BookmarkIcon />,
    iconBg: 'var(--color-warning-bg)',
    iconColor: 'var(--color-warning-text)',
    emptyText: '자주 찾는 장을 저장하세요',
    countText: (n: number) => `저장된 ${n}개의 장`,
    countKey: 'bookmarks',
  },
  {
    key: 'notes',
    name: '묵상노트',
    icon: <DocumentIcon />,
    iconBg: 'var(--color-info-bg)',
    iconColor: 'var(--color-info-text)',
    emptyText: '말씀을 읽고 묵상을 기록하세요',
    countText: (n: number) => `작성된 ${n}개의 노트`,
    countKey: 'notes',
  },
  {
    key: 'highlights',
    name: '하이라이트',
    icon: <HighlightIcon />,
    iconBg: 'var(--color-danger-bg)',
    iconColor: 'var(--color-danger-text)',
    emptyText: '중요한 구절에 색상을 입히세요',
    countText: (n: number) => `표시된 ${n}개의 구절`,
    countKey: 'highlights',
  },
  {
    key: 'history',
    name: '읽기 기록',
    icon: <HistoryIcon />,
    iconBg: 'var(--color-success-bg)',
    iconColor: 'var(--color-success-text)',
    emptyText: '읽은 장과 날짜를 확인하세요',
    countText: () => '',
    countKey: 'bookmarks', // not used for history
  },
]

// ═════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════

export default function BibleHome({
  lastPosition,
  onContinueReading,
  onViewTOC,
}: BibleHomeProps) {
  const [stats, setStats] = useState<HomeStats>({
    bookmarks: 0,
    notes: 0,
    highlights: 0,
    recentRecords: [],
  })
  const [todaySchedule, setTodaySchedule] = useState<TodaySchedule | null>(null)
  const [tipsDismissed, setTipsDismissed] = useState(false)

  // ── Data fetching ───────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTipsDismissed(
        localStorage.getItem('bible_tips_dismissed') === 'true'
      )
    }

    async function loadHomeStats() {
      try {
        const res = await fetch('/api/bible/home-stats')
        if (!res.ok) return
        const data = await res.json()
        setStats({
          bookmarks: data.bookmarks ?? 0,
          notes: data.notes ?? 0,
          highlights: data.highlights ?? 0,
          recentRecords: (data.recent_records ?? []).map(
            (r: { book: string; chapter: number; read_date: string }) => ({
              book: r.book,
              bookName: getBookName(r.book),
              chapter: r.chapter,
              readDate: r.read_date,
            })
          ),
        })
      } catch {
        // silent
      }
    }

    async function loadTodaySchedule() {
      try {
        const planId =
          typeof window !== 'undefined'
            ? localStorage.getItem('selectedPlanId')
            : null
        if (!planId) return

        const res = await fetch(
          `/api/bible/schedules/today?plan_id=${planId}`
        )
        if (!res.ok) return
        const data = await res.json()

        if (data.success && data.schedules?.length > 0) {
          const schedules = data.schedules
          const first = schedules[0]
          const completedCount = schedules.filter(
            (s: { is_completed: boolean }) => s.is_completed
          ).length

          const unit = getChapterUnit(first.book_code)
          let range = `${first.start_chapter}${unit}`
          if (
            first.end_chapter &&
            first.end_chapter !== first.start_chapter
          ) {
            range = `${first.start_chapter}-${first.end_chapter}${unit}`
          }

          setTodaySchedule({
            id: first.id,
            bookCode: first.book_code,
            bookName: getBookName(first.book_code),
            range,
            startChapter: first.start_chapter,
            endChapter: first.end_chapter || first.start_chapter,
            total: schedules.length,
            completed: completedCount,
            isCompleted: completedCount === schedules.length,
            planId: Number(planId),
          })
        }
      } catch {
        // silent
      }
    }

    void loadHomeStats()
    void loadTodaySchedule()
  }, [])

  // ── Computed values ─────────────────────────────────────────────────

  const showWelcomeGuide = useMemo(
    () =>
      !lastPosition &&
      !todaySchedule &&
      stats.recentRecords.length === 0,
    [lastPosition, todaySchedule, stats.recentRecords.length]
  )

  const showUsageTips = useMemo(() => {
    if (tipsDismissed) return false
    const total = stats.bookmarks + stats.notes + stats.highlights
    return (
      total < 3 &&
      (stats.bookmarks === 0 ||
        stats.notes === 0 ||
        stats.highlights === 0)
    )
  }, [tipsDismissed, stats.bookmarks, stats.notes, stats.highlights])

  const progressPercent = useMemo(() => {
    if (!todaySchedule || todaySchedule.total === 0) return 0
    return (todaySchedule.completed / todaySchedule.total) * 100
  }, [todaySchedule])

  // ── Callbacks ───────────────────────────────────────────────────────

  const handleStartTongdok = useCallback(() => {
    if (!todaySchedule) return
    onContinueReading(todaySchedule.bookCode, todaySchedule.startChapter)
  }, [todaySchedule, onContinueReading])

  const handleDismissTips = useCallback(() => {
    setTipsDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('bible_tips_dismissed', 'true')
    }
  }, [])

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh]" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{
          background: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <h1
          className="text-xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          성경
        </h1>
      </header>

      <div className="space-y-5 px-4 pb-8 pt-4">
        {/* ──────────── Today's Tongdok Card ──────────── */}
        {todaySchedule && (
          <section>
            <div
              className="overflow-hidden rounded-2xl p-5 text-white"
              style={{
                background:
                  'linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-hover) 100%)',
                boxShadow: '0 4px 12px rgba(75, 159, 126, 0.3)',
              }}
            >
              {/* Badge + Date */}
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  오늘의 통독
                </span>
                <span className="text-xs opacity-90">{formatTodayDate()}</span>
              </div>

              {/* Schedule */}
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-xl font-bold">
                  {todaySchedule.bookName}
                </span>
                <span className="text-base opacity-90">
                  {todaySchedule.range}
                </span>
              </div>

              {/* Progress */}
              {todaySchedule.total > 1 && (
                <div className="mb-4 flex items-center gap-3">
                  <span className="shrink-0 text-xs opacity-90">
                    {todaySchedule.completed}/{todaySchedule.total} 완료
                  </span>
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full"
                    style={{ background: 'rgba(255,255,255,0.3)' }}
                  >
                    <div
                      className="h-full rounded-full bg-white transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* CTA Button */}
              <button
                type="button"
                onClick={handleStartTongdok}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={
                  todaySchedule.isCompleted
                    ? {
                        background: 'rgba(255,255,255,0.2)',
                        color: 'white',
                      }
                    : {
                        background: 'white',
                        color: 'var(--color-accent-primary)',
                      }
                }
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

        {/* ──────────── Continue Reading ──────────── */}
        {lastPosition && (
          <section>
            <h2
              className="mb-2 text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              계속 읽기
            </h2>
            <button
              type="button"
              onClick={() =>
                onContinueReading(lastPosition.book, lastPosition.chapter)
              }
              className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 transition-all"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-tertiary)'
                e.currentTarget.style.borderColor = 'var(--color-accent-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-secondary)'
                e.currentTarget.style.borderColor = 'var(--color-border-default)'
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {getBookName(lastPosition.book)}
                </span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {lastPosition.chapter}
                  {getChapterUnit(lastPosition.book)}
                </span>
              </div>
              <ArrowRightIcon className="shrink-0" />
            </button>
          </section>
        )}

        {/* ──────────── Welcome Guide ──────────── */}
        {showWelcomeGuide && (
          <section>
            <div
              className="rounded-2xl px-6 py-8 text-center"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-default)',
              }}
            >
              <div className="mb-4 text-5xl">📖</div>
              <h2
                className="mb-2 text-lg font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                매일일독에 오신 것을 환영합니다!
              </h2>
              <p
                className="mb-6 text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                성경을 읽고, 묵상하고, 기록해보세요.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onViewTOC}
                  className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium text-white transition-all hover:opacity-90"
                  style={{
                    background: 'var(--color-accent-primary)',
                  }}
                >
                  <ListIcon />
                  성경 목차에서 시작하기
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ──────────── Feature Cards ──────────── */}
        <section>
          <h2
            className="mb-2 text-sm font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            내 성경 활동
          </h2>
          <div className="flex flex-col gap-2">
            {FEATURE_CARDS.map((card) => {
              const count =
                card.key === 'history' ? 0 : (stats[card.countKey] as number)
              const desc =
                card.key === 'history'
                  ? card.emptyText
                  : count > 0
                    ? card.countText(count)
                    : card.emptyText

              return (
                <button
                  key={card.key}
                  type="button"
                  className="flex items-center gap-3.5 rounded-xl p-3.5 transition-all"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-default)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'var(--color-bg-tertiary)'
                    e.currentTarget.style.borderColor =
                      'var(--color-border-dark)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      'var(--color-bg-secondary)'
                    e.currentTarget.style.borderColor =
                      'var(--color-border-default)'
                  }}
                >
                  {/* Icon */}
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: card.iconBg,
                      color: card.iconColor,
                    }}
                  >
                    {card.icon}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[0.9375rem] font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {card.name}
                      </span>
                      {count > 0 && (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{
                            background: 'var(--color-accent-light)',
                            color: 'var(--color-accent-primary)',
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                    <p
                      className="truncate text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {desc}
                    </p>
                  </div>

                  {/* Arrow */}
                  <ChevronRightIcon
                    className="shrink-0"
                  />
                </button>
              )
            })}
          </div>
        </section>

        {/* ──────────── Usage Tips ──────────── */}
        {showUsageTips && (
          <section
            className="rounded-xl p-4"
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <h2
              className="mb-3 text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              💡 사용 팁
            </h2>
            <div className="flex flex-col gap-3">
              {stats.highlights === 0 && (
                <TipItem
                  emoji="✨"
                  title="하이라이트 만들기"
                  desc="성경 본문에서 텍스트를 드래그하면 하이라이트, 복사, 공유 메뉴가 나타나요"
                />
              )}
              {stats.bookmarks === 0 && (
                <TipItem
                  emoji="🔖"
                  title="북마크 추가하기"
                  desc="성경 읽기 화면 상단의 북마크 아이콘을 눌러 현재 장을 저장하세요"
                />
              )}
              {stats.notes === 0 && (
                <TipItem
                  emoji="📝"
                  title="묵상노트 작성하기"
                  desc="읽기 화면의 메뉴(⋮)에서 묵상노트를 작성할 수 있어요"
                />
              )}
            </div>
            {stats.bookmarks + stats.notes + stats.highlights > 0 && (
              <button
                type="button"
                onClick={handleDismissTips}
                className="mt-3 w-full py-2 text-center text-xs transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-muted)'
                }}
              >
                다음부터 표시 안함
              </button>
            )}
          </section>
        )}

        {/* ──────────── Recent Records ──────────── */}
        {stats.recentRecords.length > 0 && (
          <section>
            <h2
              className="mb-2 text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              최근 읽은 성경
            </h2>
            <ul
              className="overflow-hidden rounded-xl"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-default)',
              }}
            >
              {stats.recentRecords.map((record) => (
                <li
                  key={`${record.book}-${record.chapter}`}
                  className="cursor-pointer transition-colors"
                  style={{
                    borderBottom: '1px solid var(--color-border-default)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'var(--color-bg-tertiary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3"
                    onClick={() =>
                      onContinueReading(record.book, record.chapter)
                    }
                  >
                    <span
                      className="text-[0.9375rem]"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {record.bookName} {record.chapter}
                      {getChapterUnit(record.book)}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {formatDate(record.readDate)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ──────────── TOC Shortcut ──────────── */}
        <section>
          <button
            type="button"
            onClick={onViewTOC}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[0.9375rem] transition-all"
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-bg-tertiary)'
              e.currentTarget.style.borderColor = 'var(--color-accent-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-bg-secondary)'
              e.currentTarget.style.borderColor = 'var(--color-border-default)'
            }}
          >
            <span style={{ color: 'var(--color-accent-primary)' }}>
              <ListIcon />
            </span>
            성경 전체 목차
          </button>
        </section>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────

function TipItem({
  emoji,
  title,
  desc,
}: {
  emoji: string
  title: string
  desc: string
}) {
  return (
    <div
      className="flex gap-3 rounded-lg p-3"
      style={{ background: 'var(--color-bg-tertiary)' }}
    >
      <span className="shrink-0 text-xl">{emoji}</span>
      <div>
        <strong
          className="block text-sm"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </strong>
        <p
          className="text-xs leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {desc}
        </p>
      </div>
    </div>
  )
}
