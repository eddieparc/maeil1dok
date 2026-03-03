'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/hooks/useToast'
import type { DailySchedule, BibleReadingPlan, PlanSubscription } from '@/types'
import styles from './plan.module.css'

/* ── helpers ─────────────────────────────────────────── */

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

type ReadingStatus = 'completed' | 'missed' | 'current' | 'upcoming'

function getStatus(dateStr: string, isCompleted: boolean): ReadingStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  if (isCompleted) return 'completed'
  if (d < today) return 'missed'
  if (d.getTime() === today.getTime()) return 'current'
  return 'upcoming'
}

const STATUS_LABEL: Record<ReadingStatus, string> = {
  completed: '완료',
  missed: '미완료',
  current: '오늘',
  upcoming: '예정',
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dayName = DAY_NAMES[d.getDay()]
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${dayName})`
}

function formatChapter(start: number, end: number): string {
  if (start === end) return `${start}장`
  return `${start}-${end}장`
}

function isToday(dateStr: string): boolean {
  const today = new Date()
  const [y, m, d] = dateStr.split('-').map(Number)
  return y === today.getFullYear() && m === today.getMonth() + 1 && d === today.getDate()
}

/* ── types ───────────────────────────────────────────── */

type ScheduleWithProgress = DailySchedule & { isCompleted: boolean }

interface PlanPageClientProps {
  schedules: DailySchedule[]
  progressMap: Record<string, boolean>
  currentYear: number
  currentMonth: number
  subscriptionId: string
  subscriptions: PlanSubscription[]
  plans: BibleReadingPlan[]
  selectedSubscriptionId: string
}

/* ── Status icon SVG ─────────────────────────────────── */
function StatusIcon({ status }: { status: ReadingStatus }) {
  if (status === 'completed') {
    return (
      <svg className={styles.statusIcon} viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg className={styles.statusIcon} viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/* ── component ───────────────────────────────────────── */

export default function PlanPageClient({
  schedules,
  progressMap: initialProgressMap,
  currentYear,
  currentMonth,
  subscriptionId,
  subscriptions,
  plans,
  selectedSubscriptionId,
}: PlanPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const scrollRef = useRef<HTMLDivElement>(null)
  const monthScrollRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [isBulkEditMode, setIsBulkEditMode] = useState(false)
  const [localProgress, setLocalProgress] = useState<Record<string, boolean>>(initialProgressMap)

  // Bulk edit state
  const [bulkFirst, setBulkFirst] = useState<string | null>(null)
  const [bulkSecond, setBulkSecond] = useState<string | null>(null)

  const planMap = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])
  const selectedPlanName = useMemo(() => {
    const sub = subscriptions.find((s) => s.id === selectedSubscriptionId)
    if (!sub) return '플랜'
    return planMap.get(sub.planId)?.name ?? '플랜'
  }, [subscriptions, selectedSubscriptionId, planMap])

  // Flat list of schedules with progress (matching production: each item = one card)
  const enrichedSchedules: ScheduleWithProgress[] = useMemo(
    () => schedules.map((s) => ({ ...s, isCompleted: localProgress[s.id] ?? false })),
    [schedules, localProgress],
  )

  const completedCount = useMemo(
    () => enrichedSchedules.filter((s) => s.isCompleted).length,
    [enrichedSchedules],
  )

  // Auto-scroll month pill into view
  useEffect(() => {
    if (monthScrollRef.current) {
      const activePill = monthScrollRef.current.querySelector(`.${styles.active}`) as HTMLElement
      if (activePill) {
        activePill.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [currentMonth])

  /* ── navigation ────────────────────────────────────── */

  function navigateToMonth(month: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('planId', subscriptionId)
    params.set('year', String(currentYear))
    params.set('month', String(month))
    startTransition(() => {
      router.push(`/plan?${params.toString()}`)
    })
  }

  function handlePlanChange(subId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('planId', subId)
    startTransition(() => {
      router.push(`/plan?${params.toString()}`)
    })
  }

  /* ── quick navigation ──────────────────────────────── */

  function scrollToToday() {
    const todayStr = new Date().toISOString().split('T')[0]
    const todayMonth = new Date().getMonth() + 1
    if (currentMonth !== todayMonth) {
      navigateToMonth(todayMonth)
      return
    }
    const el = scrollRef.current?.querySelector(`[data-date="${todayStr}"]`) as HTMLElement
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function scrollToLastIncomplete() {
    if (!scrollRef.current) return
    const items = scrollRef.current.querySelectorAll('[data-schedule-status="missed"], [data-schedule-status="current"]')
    const last = items[items.length - 1] as HTMLElement
    if (last) {
      last.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  /* ── schedule completion toggle ────────────────────── */

  const toggleCompletion = useCallback(
    async (scheduleId: string) => {
      const wasCompleted = localProgress[scheduleId] ?? false
      const newCompleted = !wasCompleted

      setLocalProgress((prev) => ({ ...prev, [scheduleId]: newCompleted }))

      try {
        const res = await fetch('/api/bible/schedules/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schedule_id: scheduleId,
            subscription_id: subscriptionId,
          }),
        })

        if (!res.ok) throw new Error('Failed')

        toast({
          message: newCompleted ? '읽음 처리되었습니다.' : '읽지 않음으로 변경되었습니다.',
          variant: 'success',
        })
      } catch {
        setLocalProgress((prev) => ({ ...prev, [scheduleId]: wasCompleted }))
        toast({ message: '상태 변경에 실패했습니다.', variant: 'error' })
      }
    },
    [localProgress, subscriptionId, toast],
  )

  /* ── bulk edit ─────────────────────────────────────── */

  function toggleBulkEditMode() {
    setIsBulkEditMode((prev) => {
      if (prev) { setBulkFirst(null); setBulkSecond(null) }
      return !prev
    })
  }

  function handleBulkSelect(date: string) {
    if (!bulkFirst) setBulkFirst(date)
    else if (!bulkSecond) setBulkSecond(date)
    else { setBulkFirst(date); setBulkSecond(null) }
  }

  async function handleBulkAction(action: 'complete' | 'cancel') {
    if (!bulkFirst || !bulkSecond) return
    const start = bulkFirst < bulkSecond ? bulkFirst : bulkSecond
    const end = bulkFirst < bulkSecond ? bulkSecond : bulkFirst
    const affectedIds = schedules.filter((s) => s.date >= start && s.date <= end).map((s) => s.id)
    const isComplete = action === 'complete'

    setLocalProgress((prev) => {
      const next = { ...prev }
      for (const id of affectedIds) next[id] = isComplete
      return next
    })
    setBulkFirst(null); setBulkSecond(null); setIsBulkEditMode(false)

    try {
      if (isComplete) {
        await Promise.all(
          affectedIds.map((id) =>
            fetch('/api/bible/schedules/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ schedule_id: id, subscription_id: subscriptionId }),
            }),
          ),
        )
      }
      toast({
        message: isComplete ? '일괄 읽음 처리되었습니다.' : '일괄 읽지 않음 처리되었습니다.',
        variant: 'success',
      })
    } catch {
      toast({ message: '일괄 처리에 실패했습니다.', variant: 'error' })
    }
  }

  function isInBulkRange(date: string): boolean {
    if (!bulkFirst) return false
    if (!bulkSecond) return date === bulkFirst
    const start = bulkFirst < bulkSecond ? bulkFirst : bulkSecond
    const end = bulkFirst < bulkSecond ? bulkSecond : bulkFirst
    return date >= start && date <= end
  }

  /* ── scroll handling ───────────────────────────────── */

  function handleScroll() {
    if (scrollRef.current) setShowScrollTop(scrollRef.current.scrollTop > 200)
  }

  function scrollToTop() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* ── render ────────────────────────────────────────── */

  return (
    <div className={styles.container}>
      {/* ── Fixed header ─────────────────────────────── */}
      <div className={styles.fixedArea}>
        <div className={styles.headerRow}>
          <h1 className={styles.headerTitle}>성경통독표</h1>
          <button
            className={`${styles.editModeButton} ${isBulkEditMode ? styles.active : ''}`}
            onClick={toggleBulkEditMode}
          >
            {isBulkEditMode ? '완료' : '일괄수정'}
          </button>
        </div>

        {/* ── Plan selector + Month pills ────────────── */}
        <div className={styles.controlsRow}>
          {/* Plan selector */}
          <div className={styles.planSelectButton}>
            <span>{selectedPlanName}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {subscriptions.length > 1 && (
              <select
                className={styles.planSelectDropdown}
                value={selectedSubscriptionId}
                onChange={(e) => handlePlanChange(e.target.value)}
                aria-label="플랜 선택"
              >
                {subscriptions.filter((s) => s.isActive).map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {planMap.get(sub.planId)?.name ?? '플랜'}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className={styles.controlsDivider} />

          {/* Month pills */}
          <div className={styles.monthScroll} ref={monthScrollRef}>
            {MONTHS.map((m) => (
              <button
                key={m}
                className={`${styles.monthPill} ${m === currentMonth ? styles.active : ''}`}
                onClick={() => navigateToMonth(m)}
              >
                {m}월
              </button>
            ))}
          </div>
        </div>

        {/* ── Quick navigation ───────────────────────── */}
        <div className={styles.quickNav}>
          <span className={styles.quickNavLabel}>빠른 이동</span>
          <span className={styles.quickNavDivider}>|</span>
          <button className={styles.quickNavButton} onClick={scrollToToday}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" />
              <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
            </svg>
            오늘
          </button>
          <button className={styles.quickNavButton} onClick={scrollToLastIncomplete}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
            </svg>
            마지막 미완료
          </button>
        </div>

        {/* ── Bulk edit indicator ────────────────────── */}
        {isBulkEditMode && (
          <div className={styles.bulkEditBar}>
            {!bulkFirst && <span>시작 날짜를 선택해주세요</span>}
            {bulkFirst && !bulkSecond && <span>마지막 날짜를 선택해주세요</span>}
            {bulkFirst && bulkSecond && (
              <>
                <span>선택한 일정을</span>
                <button onClick={() => handleBulkAction('complete')}>읽음</button>
                <span>|</span>
                <button className={styles.bulkActionCancel} onClick={() => handleBulkAction('cancel')}>읽지않음</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Scrollable schedule list ─────────────────── */}
      <div className={styles.scrollArea} ref={scrollRef} onScroll={handleScroll}>
        {isPending ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner} />
            <span className={styles.loadingText}>일정을 불러오는 중...</span>
          </div>
        ) : enrichedSchedules.length === 0 ? (
          <div className={styles.emptyState}>
            <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" />
            </svg>
            <span className={styles.emptyText}>{currentMonth}월에 등록된 일정이 없습니다</span>
          </div>
        ) : (
          <div className={`${styles.scheduleList} ${styles.fadeIn}`}>
            {enrichedSchedules.map((item) => {
              const status = getStatus(item.date, item.isCompleted)
              const todayDate = isToday(item.date)
              const inRange = isBulkEditMode && isInBulkRange(item.date)

              return (
                <div
                  key={item.id}
                  data-date={item.date}
                  data-schedule-status={status}
                  className={`${styles.scheduleItem} ${styles[status] ?? ''} ${inRange ? styles.selectedRange ?? '' : ''}`}
                  onClick={isBulkEditMode ? () => handleBulkSelect(item.date) : undefined}
                >
                  {/* Checkbox */}
                  <div
                    className={styles.checkbox}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isBulkEditMode) toggleCompletion(item.id)
                    }}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={item.isCompleted}
                      readOnly
                      tabIndex={-1}
                    />
                  </div>

                  {/* Content: date + reading */}
                  <div className={styles.scheduleInfo}>
                    <div className={styles.scheduleDate}>
                      {todayDate && <span className={styles.todayBadge}>오늘</span>}
                      {formatDateFull(item.date)}
                    </div>
                    <span className={styles.scheduleReading}>
                      {item.book} {formatChapter(item.startChapter, item.endChapter)}
                    </span>
                  </div>

                  {/* Status indicator */}
                  <div className={`${styles.statusIndicator} ${styles[status] ?? ''}`}>
                    <StatusIcon status={status} />
                    {STATUS_LABEL[status]}
                  </div>
                </div>
              )
            })}

            {/* Completion summary */}
            {enrichedSchedules.length > 0 && (
              <div style={{
                textAlign: 'center',
                padding: '1rem 0 0.5rem',
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
              }}>
                {completedCount}/{enrichedSchedules.length}일 완료
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scroll to top */}
      <button
        className={`${styles.scrollTopButton} ${showScrollTop ? styles.visible : ''}`}
        onClick={scrollToTop}
        aria-label="맨 위로 스크롤"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M12 5l-7 7M12 5l7 7" />
        </svg>
      </button>
    </div>
  )
}

/* ── Non-logged-in version ───────────────────────────── */

export function PlanPageGuest() {
  return (
    <div className={styles.container}>
      <div className={styles.fixedArea}>
        <div className={styles.headerRow}>
          <h1 className={styles.headerTitle}>성경통독표</h1>
          <Link href="/login?redirect=/plan">
            <button className={styles.editModeButton}>로그인</button>
          </Link>
        </div>
      </div>
      <div className={styles.scrollArea}>
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={styles.emptyText}>로그인하면 통독 진행 상황을 기록할 수 있어요</span>
          <div className={styles.emptyAction}>
            <Link href="/login?redirect=/plan">
              <button className={styles.emptyButton}>로그인하기</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── No subscription version ─────────────────────────── */

export function PlanPageEmpty() {
  return (
    <div className={styles.container}>
      <div className={styles.fixedArea}>
        <div className={styles.headerRow}>
          <h1 className={styles.headerTitle}>성경통독표</h1>
        </div>
      </div>
      <div className={styles.scrollArea}>
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" />
          </svg>
          <span className={styles.emptyText}>구독 중인 플랜이 없습니다</span>
          <div className={styles.emptyAction}>
            <Link href="/plans">
              <button className={styles.emptyButton}>플랜 둘러보기</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
